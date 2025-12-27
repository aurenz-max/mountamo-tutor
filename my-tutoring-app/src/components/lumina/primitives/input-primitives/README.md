# Input Primitives

Reusable Lumina-themed input components for interactive mathematical and educational experiences.

## CalculatorInput

A beautiful calculator-style number input component with the Lumina design language.

### Features

- 🎨 **Lumina-themed styling** - Glass panel design with orange accents
- 🔢 **Full calculator keypad** - 0-9, decimal, negative, clear, backspace
- ✅ **Submit button** - Optional green gradient submit button
- 🎯 **Highly configurable** - Control decimals, negatives, max length, etc.
- ⌨️ **Keyboard support** - Enter key triggers submit
- 🎭 **Smooth animations** - Button hover and click effects
- ♿ **Accessible** - Proper ARIA labels and keyboard navigation

### Quick Start

```tsx
import CalculatorInput from '@/components/lumina/primitives/input-primitives/CalculatorInput';

function MyComponent() {
  const [answer, setAnswer] = useState('');

  return (
    <CalculatorInput
      label="x ="
      value={answer}
      onChange={setAnswer}
      onSubmit={() => console.log('Submitted:', answer)}
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `undefined` | Optional label shown above the display |
| `value` | `string` | **required** | Current input value (controlled component) |
| `onChange` | `(value: string) => void` | **required** | Callback when value changes |
| `onSubmit` | `() => void` | `undefined` | Callback when submit button is clicked or Enter is pressed |
| `placeholder` | `string` | `'0'` | Placeholder text shown when value is empty |
| `disabled` | `boolean` | `false` | Disable all input |
| `showSubmitButton` | `boolean` | `true` | Show/hide the submit (✓) button |
| `maxLength` | `number` | `10` | Maximum number of characters allowed |
| `allowNegative` | `boolean` | `true` | Allow negative numbers (shows - button) |
| `allowDecimal` | `boolean` | `true` | Allow decimal numbers (shows . button) |
| `className` | `string` | `''` | Additional CSS classes for the container |

### Examples

#### Basic Math Problem

```tsx
<CalculatorInput
  label="Answer ="
  value={userAnswer}
  onChange={setUserAnswer}
  onSubmit={checkAnswer}
  allowNegative={false}
  allowDecimal={false}
/>
```

#### Real-time Value Display (No Submit Button)

```tsx
<CalculatorInput
  label="Enter a number"
  value={currentValue}
  onChange={setCurrentValue}
  showSubmitButton={false}
  allowNegative={true}
  allowDecimal={true}
/>
```

#### Integer-Only Input

```tsx
<CalculatorInput
  label="How many?"
  value={count}
  onChange={setCount}
  allowNegative={false}
  allowDecimal={false}
  maxLength={3}
/>
```

#### Algebraic Variable Input

```tsx
<CalculatorInput
  label="Solve for x"
  value={xValue}
  onChange={setXValue}
  onSubmit={validateSolution}
  allowNegative={true}
  allowDecimal={true}
/>
```

### Usage in Primitives

The CalculatorInput is perfect for:

- **Math problem solving** (equations, word problems)
- **Variable input** (algebra, calculus)
- **Number guessing games**
- **Measurement input** (geometry, physics)
- **Score tracking**
- **Statistical data entry**
- **Any numeric input in educational contexts**

### Styling

The component uses the Lumina glass-panel design with:
- Orange accent colors (`orange-500/20` borders and glows)
- Dark slate backgrounds (`slate-900/80`)
- Smooth transitions and hover effects
- Radial dot background pattern
- Consistent with other Lumina primitives

### Keyboard Shortcuts

- **0-9**: Enter digits
- **. (period)**: Enter decimal point (if allowed)
- **- (minus)**: Enter negative sign at start (if allowed)
- **Backspace**: Delete last character
- **C**: Clear all input
- **Enter**: Submit (if `onSubmit` is provided)

### Integration Example

Here's how TapeDiagram uses CalculatorInput:

```tsx
<CalculatorInput
  label={`${segment.label} =`}
  value={userAnswers[key] || ''}
  onChange={(value) => handleAnswerChange(barIndex, segmentIndex, value)}
  onSubmit={() => handleAnswerSubmit(barIndex, segmentIndex)}
  showSubmitButton={true}
  allowNegative={true}
  allowDecimal={true}
  className="mb-6"
/>
```

### Testing

See `CalculatorInputExample.tsx` for a comprehensive testing component with multiple use cases.

### Future Enhancements

Potential improvements for future versions:
- Scientific calculator mode (sin, cos, sqrt, etc.)
- Expression evaluation (support for operations like 5+3)
- History/undo functionality
- Custom button layouts
- Theming variants (different color schemes)
- Audio feedback for button clicks
- Accessibility improvements (screen reader announcements)

### Design Philosophy

The CalculatorInput follows Lumina's design principles:
1. **Beauty & Function** - Visually stunning while highly functional
2. **Consistency** - Matches other Lumina primitives in style and behavior
3. **Reusability** - One component, many use cases
4. **Configurability** - Props for common customizations
5. **Accessibility** - Keyboard navigation and semantic HTML

---

**Part of the Lumina Exhibit System** - Building beautiful, interactive educational experiences.
