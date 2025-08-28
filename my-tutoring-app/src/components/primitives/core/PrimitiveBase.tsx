import React, { useState, useEffect, useCallback } from 'react';
import { PrimitiveProps, PrimitiveAnswer, PrimitiveState } from './PrimitiveTypes';

/**
 * Base component that all primitives extend
 * Provides common functionality like state management, validation, and answer handling
 */
export class PrimitiveBase<T extends PrimitiveProps = PrimitiveProps> extends React.Component<T, PrimitiveState> {
  constructor(props: T) {
    super(props);
    
    this.state = {
      isValid: false,
      hasAnswer: false,
      answer: props.initialAnswer || null,
      isDirty: false
    };
  }

  componentDidMount() {
    // Initialize from props if available
    if (this.props.initialAnswer) {
      this.setState({
        answer: this.props.initialAnswer,
        hasAnswer: true,
        isValid: this.validateAnswer(this.props.initialAnswer),
        isDirty: false
      });
    }
  }

  /**
   * Override this method in child components to implement specific validation logic
   */
  protected validateAnswer(answer: PrimitiveAnswer | null): boolean {
    return answer !== null && answer.value !== undefined && answer.value !== null;
  }

  /**
   * Override this method in child components to handle answer updates
   */
  protected createAnswer(value: any, metadata?: Record<string, any>): PrimitiveAnswer {
    return {
      type: this.constructor.name.toLowerCase().replace('primitive', ''),
      value,
      metadata
    };
  }

  /**
   * Call this method from child components when the answer changes
   */
  protected updateAnswer = (value: any, metadata?: Record<string, any>) => {
    const answer = this.createAnswer(value, metadata);
    const isValid = this.validateAnswer(answer);
    
    this.setState({
      answer,
      hasAnswer: true,
      isValid,
      isDirty: true
    }, () => {
      // Notify parent component
      if (this.props.onChange) {
        this.props.onChange(answer);
      }
    });
  };

  /**
   * Clear the current answer
   */
  protected clearAnswer = () => {
    this.setState({
      answer: null,
      hasAnswer: false,
      isValid: false,
      isDirty: true
    }, () => {
      if (this.props.onChange) {
        this.props.onChange(this.createAnswer(null));
      }
    });
  };

  /**
   * Get current answer state - useful for parent components
   */
  public getAnswerState(): PrimitiveState {
    return { ...this.state };
  }

  /**
   * Override this method in child components to implement the primitive UI
   */
  protected renderPrimitive(): React.ReactNode {
    return (
      <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
        Primitive not implemented
      </div>
    );
  }

  render() {
    return (
      <div className="primitive-container">
        {this.renderPrimitive()}
      </div>
    );
  }
}

/**
 * Hook-based base for functional components
 */
export function usePrimitive<T = any>(
  id: string,
  initialAnswer?: PrimitiveAnswer,
  onChange?: (answer: PrimitiveAnswer) => void,
  validator?: (answer: PrimitiveAnswer | null) => boolean
) {
  const [state, setState] = useState<PrimitiveState>({
    isValid: false,
    hasAnswer: !!initialAnswer,
    answer: initialAnswer || null,
    isDirty: false
  });

  const createAnswer = useCallback((value: T, metadata?: Record<string, any>): PrimitiveAnswer => {
    return {
      type: id,
      value,
      metadata
    };
  }, [id]);

  const validateAnswer = useCallback((answer: PrimitiveAnswer | null): boolean => {
    if (validator) {
      return validator(answer);
    }
    return answer !== null && answer.value !== undefined && answer.value !== null;
  }, [validator]);

  const updateAnswer = useCallback((value: T, metadata?: Record<string, any>) => {
    const answer = createAnswer(value, metadata);
    const isValid = validateAnswer(answer);
    
    setState({
      answer,
      hasAnswer: true,
      isValid,
      isDirty: true
    });

    if (onChange) {
      onChange(answer);
    }
  }, [createAnswer, validateAnswer, onChange]);

  const clearAnswer = useCallback(() => {
    const answer = createAnswer(null as T);
    setState({
      answer: null,
      hasAnswer: false,
      isValid: false,
      isDirty: true
    });

    if (onChange) {
      onChange(answer);
    }
  }, [createAnswer, onChange]);

  useEffect(() => {
    if (initialAnswer) {
      setState({
        answer: initialAnswer,
        hasAnswer: true,
        isValid: validateAnswer(initialAnswer),
        isDirty: false
      });
    }
  }, [initialAnswer, validateAnswer]);

  return {
    ...state,
    updateAnswer,
    clearAnswer,
    createAnswer,
    validateAnswer
  };
}