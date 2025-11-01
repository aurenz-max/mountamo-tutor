'use client';

import React, { useId } from 'react';

// Backend schema format (primary)
interface CardItemBackend {
  id: string;
  content_type: 'text' | 'image' | 'image_with_label';
  primary_value: string; // Text content or emoji/image identifier
  label?: string; // For image_with_label type
  style?: 'default' | 'large' | 'small';
}

// Legacy format (backward compatibility)
interface CardItemLegacy {
  id: string;
  shape?: string;
  color?: string;
  label?: string;
  icon?: string;
  image_url?: string;
  size?: 'small' | 'medium' | 'large';
}

type CardItem = CardItemBackend | CardItemLegacy;

interface CardGridData {
  instruction?: string;
  cards: CardItem[];
  columns?: number;
  grid_columns?: number; // Backend uses grid_columns
  layout?: 'grid' | 'row' | 'column';
  card_style?: 'minimal' | 'bordered' | 'elevated';
}

interface CardGridProps {
  data: CardGridData;
  className?: string;
  // Interaction props for live_interaction
  selectedTargetId?: string | null;
  onTargetClick?: (targetId: string) => void;
  isSubmitted?: boolean;
  getTargetState?: (targetId: string) => 'default' | 'selected' | 'correct' | 'incorrect';
  // Legacy props (backward compatibility)
  selectedCard?: string | null;
  onCardClick?: (cardId: string) => void;
  disabled?: boolean;
  highlightCorrect?: boolean;
  correctCardIds?: string[];
}

/**
 * CardGrid - Visual primitive for displaying a grid of interactive cards
 *
 * Use Cases:
 * - Shape identification (click the circle)
 * - Object selection (find the red apple)
 * - Pattern matching (click matching items)
 * - Color recognition (select all blue objects)
 */
export const CardGrid: React.FC<CardGridProps> = ({
  data,
  className = '',
  // New interaction props
  selectedTargetId,
  onTargetClick,
  isSubmitted = false,
  getTargetState,
  // Legacy props (backward compatibility)
  selectedCard = null,
  onCardClick,
  disabled = false,
  highlightCorrect = false,
  correctCardIds = []
}) => {
  const instanceId = useId();
  const { instruction, cards, columns, grid_columns, layout = 'grid', card_style = 'elevated' } = data;

  // Determine column count (backend uses grid_columns, legacy uses columns)
  const columnCount = grid_columns || columns || 3;

  // Unified interaction handlers (new takes precedence)
  const handleClick = onTargetClick || onCardClick;
  const selectedId = selectedTargetId || selectedCard;
  const isDisabled = disabled || isSubmitted;

  if (!cards || cards.length === 0) {
    return null;
  }

  // Shape emoji mapping
  const shapeEmojis: Record<string, string> = {
    circle: '🔵',
    square: '🟦',
    triangle: '🔺',
    rectangle: '▬',
    star: '⭐',
    heart: '❤️',
    diamond: '💎',
    oval: '⬭',
    hexagon: '⬡',
    pentagon: '⬟'
  };

  // Color to emoji/style mapping
  const colorStyles: Record<string, string> = {
    red: 'bg-red-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
    yellow: 'bg-yellow-400',
    orange: 'bg-orange-400',
    purple: 'bg-purple-400',
    pink: 'bg-pink-400',
    brown: 'bg-amber-700',
    black: 'bg-gray-800',
    white: 'bg-white',
    gray: 'bg-gray-400'
  };

  // Type guard for backend schema
  const isBackendFormat = (card: CardItem): card is CardItemBackend => {
    return 'content_type' in card && 'primary_value' in card;
  };

  const renderCardContent = (card: CardItem) => {
    // BACKEND SCHEMA FORMAT (primary)
    if (isBackendFormat(card)) {
      switch (card.content_type) {
        case 'text':
          return (
            <div className="text-3xl font-bold text-gray-800">
              {card.primary_value}
            </div>
          );
        case 'image':
          // Emoji or image identifier
          return (
            <div className="text-6xl">
              {card.primary_value}
            </div>
          );
        case 'image_with_label':
          return (
            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl">
                {card.primary_value}
              </div>
              {card.label && (
                <div className="text-sm font-medium text-gray-700">
                  {card.label}
                </div>
              )}
            </div>
          );
        default:
          return (
            <div className="text-2xl font-semibold text-gray-700">
              {card.primary_value}
            </div>
          );
      }
    }

    // LEGACY FORMAT (backward compatibility)
    const legacyCard = card as CardItemLegacy;

    // If image URL provided, use that
    if (legacyCard.image_url) {
      return (
        <img
          src={legacyCard.image_url}
          alt={legacyCard.label || legacyCard.id}
          className="w-full h-full object-contain"
        />
      );
    }

    // If custom icon/emoji provided
    if (legacyCard.icon) {
      return (
        <div className="text-6xl">
          {legacyCard.icon}
        </div>
      );
    }

    // If shape specified, render the shape
    if (legacyCard.shape) {
      const emoji = shapeEmojis[legacyCard.shape.toLowerCase()] || '⬜';

      // Apply color if specified
      if (legacyCard.color) {
        const colorClass = colorStyles[legacyCard.color.toLowerCase()];
        return (
          <div className="flex items-center justify-center">
            <div className={`w-20 h-20 rounded-full ${colorClass || 'bg-gray-300'} shadow-md`}></div>
          </div>
        );
      }

      return (
        <div className="text-6xl">
          {emoji}
        </div>
      );
    }

    // Fallback to label
    return (
      <div className="text-2xl font-semibold text-gray-700">
        {legacyCard.label || legacyCard.id}
      </div>
    );
  };

  const getCardSizeClass = (size?: string) => {
    switch (size) {
      case 'small':
        return 'p-4';
      case 'large':
        return 'p-8';
      default:
        return 'p-6';
    }
  };

  const getCardStyleClass = () => {
    switch (card_style) {
      case 'minimal':
        return 'border border-gray-200 bg-white';
      case 'bordered':
        return 'border-2 border-gray-300 bg-white';
      case 'elevated':
      default:
        return 'border border-gray-200 bg-white shadow-sm';
    }
  };

  // Unified state management (new getTargetState takes precedence)
  const getCardState = (cardId: string): 'default' | 'selected' | 'correct' | 'incorrect' => {
    if (getTargetState) {
      return getTargetState(cardId);
    }

    // Legacy state logic
    if (highlightCorrect && correctCardIds.includes(cardId)) {
      return 'correct';
    }
    if (selectedId === cardId) {
      return 'selected';
    }
    return 'default';
  };

  return (
    <div className={`p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl ${className}`}>
      {/* Optional instruction */}
      {instruction && (
        <div className="text-center mb-6">
          <p className="text-lg font-semibold text-gray-800">{instruction}</p>
        </div>
      )}

      {/* Card Grid */}
      <div
        className={`gap-4 ${layout === 'row' ? 'flex flex-row' : layout === 'column' ? 'flex flex-col' : 'grid'}`}
        style={layout === 'grid' ? {
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`
        } : {}}
      >
        {cards.map((card) => {
          const state = getCardState(card.id);
          const cardSize = isBackendFormat(card) ? card.style : (card as CardItemLegacy).size;

          return (
            <div
              key={`${instanceId}-${card.id}`}
              onClick={() => !isDisabled && handleClick && handleClick(card.id)}
              className={`
                ${getCardStyleClass()}
                ${getCardSizeClass(cardSize)}
                rounded-xl
                flex flex-col items-center justify-center
                transition-all duration-200
                ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-105 hover:shadow-md'}
                ${state === 'selected' ? 'ring-4 ring-blue-300 scale-105' : ''}
                ${state === 'correct' ? 'ring-4 ring-green-400 scale-105 bg-green-50' : ''}
                ${state === 'incorrect' ? 'ring-4 ring-red-400 scale-105 bg-red-50' : ''}
              `}
            >
              {/* Card Content */}
              <div className="mb-2">
                {renderCardContent(card)}
              </div>

              {/* Card Label (for legacy format) */}
              {!isBackendFormat(card) && (card as CardItemLegacy).label && (
                <div className="text-sm text-center text-gray-600 font-medium mt-2">
                  {(card as CardItemLegacy).label}
                </div>
              )}

              {/* Selection indicator */}
              {state === 'selected' && (
                <div className="mt-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              )}

              {/* Correct indicator */}
              {state === 'correct' && (
                <div className="mt-2 text-green-600 font-bold text-sm">✓ Correct!</div>
              )}

              {/* Incorrect indicator */}
              {state === 'incorrect' && (
                <div className="mt-2 text-red-600 font-bold text-sm">✗ Try again</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CardGrid;
