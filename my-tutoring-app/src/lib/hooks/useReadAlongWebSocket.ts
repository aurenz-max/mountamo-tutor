import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { ReadAlongContent } from '@/types/read-along'

interface UseReadAlongWebSocketProps {
  initialSessionId?: string
  onReadAlongReceived?: (content: ReadAlongContent) => void
  onSessionStarted?: (sessionId: string) => void
}

export default function useReadAlongWebSocket({
  initialSessionId,
  onReadAlongReceived,
  onSessionStarted
}: UseReadAlongWebSocketProps) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialSessionId)
  const wsRef = useRef<WebSocket | null>(null)
  const { toast } = useToast()

  // Initialize WebSocket connection
  useEffect(() => {
    let ws = wsRef.current

    const connectWebSocket = () => {
      // Connect to the existing tutoring websocket endpoint
      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      ws = new WebSocket(`${wsBaseUrl}/api/tutoring/session`)
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('WebSocket connected')
        
        // Initialize session
        if (initialSessionId) {
          // Connect to existing session
          ws.send(JSON.stringify({
            text: "InitSession",
            data: {
              session_id: initialSessionId
            }
          }))
        } else {
          // Create a new session for read-along
          ws.send(JSON.stringify({
            text: "InitSession",
            data: {
                subject: "reading",
                skill_description: "Reading Practice",
                subskill_description: "Read-Along Activities",
                student_id: 1, // Default student ID
                competency_score: 5.0,
                // Add these to match the format of the tutoring session
                skill_id: "read_along",
                subskill_id: "read_along_practice"
              }
          }))
        }
      }
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        // Handle different message types
        if (data.type === "session_started") {
          setConnected(true)
          setCurrentSessionId(data.session_id)
          
          toast({
            title: 'Connected',
            description: `Session ${data.session_id} started`,
          })
          
          if (onSessionStarted) {
            onSessionStarted(data.session_id)
          }
        } 
        else if (data.type === "read_along") {
          // This matches our backend implementation now
          setLoading(false)
          
          if (onReadAlongReceived && data.content) {
            onReadAlongReceived(data.content)
          }
          
          toast({
            title: 'Read-Along Received',
            description: 'New read-along content is available',
          })
        }
        else if (data.type === "image") {
          // Handle image received from the read-along service
          console.log('Received image data:', data)
          // We might need to associate this with the read-along content
          // depending on your application's requirements
        }
        else if (data.type === "error") {
          setLoading(false)
          toast({
            title: 'Error',
            description: data.message || 'An error occurred',
            variant: 'destructive',
          })
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to the server',
          variant: 'destructive',
        })
        setConnected(false)
      }
      
      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setConnected(false)
        
        // Try to reconnect after a delay
        setTimeout(() => {
          if (wsRef.current === ws) {
            connectWebSocket()
          }
        }, 3000)
      }
    }
    
    if (!ws) {
      connectWebSocket()
    }
    
    // Clean up function
    return () => {
      if (ws) {
        ws.close()
        wsRef.current = null
      }
    }
  }, [initialSessionId, toast, onReadAlongReceived, onSessionStarted])

  // Function to send read-along generation request
  const sendReadAlongRequest = useCallback((options: any) => {
    if (!wsRef.current || !connected) {
      toast({
        title: 'Not Connected',
        description: 'Please wait for the connection to be established',
        variant: 'destructive',
      })
      return
    }
    
    setLoading(true)
    
    try {
      // Updated to match the backend's expected message format
      wsRef.current.send(JSON.stringify({
        type: "read_along_request", // Changed from "generate_read_along" to match backend
        complexity_level: options.readingLevel || 1,
        theme: options.theme || undefined,
        with_image: options.withImage !== undefined ? options.withImage : true,
        student_grade: options.studentGrade || 'kindergarten',
        student_interests: options.studentInterests || ['animals'],
        reading_level: options.readingLevel || 1
      }))
    } catch (error) {
      console.error('Error sending read-along request:', error)
      setLoading(false)
      toast({
        title: 'Error',
        description: 'Failed to send read-along generation request',
        variant: 'destructive',
      })
    }
  }, [connected, toast])

  return {
    connected,
    loading,
    currentSessionId,
    sendReadAlongRequest
  }
}