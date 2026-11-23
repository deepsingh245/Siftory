import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type FieldSelectProps<Value extends string> = {
  label: string
  value: Value
  options: readonly (readonly [Value, string])[]
  onValueChange: (value: Value) => void
  className?: string
  hideLabel?: boolean
  disabled?: boolean
}

export function FieldSelect<Value extends string>({
  label, value, options, onValueChange, className, hideLabel, disabled,
}: FieldSelectProps<Value>) {
  const id = useId()
  // Radix reserves the empty string for clearing the selection. "Any" is a real choice.
  const selected = options.some(([key]) => key === value) ? `option:${value}` : ''

  return <div className={className ?? 'form-field'}>
    <Label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</Label>
    <Select value={selected} disabled={disabled || !options.length} onValueChange={(next) => {
      const option = options.find(([key]) => `option:${key}` === next)
      if (option) onValueChange(option[0])
    }}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={options.length ? 'Select an option' : 'No options available'} />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-w-(--radix-select-content-available-width)">
        {options.map(([key, name]) => <SelectItem key={key} value={`option:${key}`} className="min-h-9">{name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
}
