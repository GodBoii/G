const VALUES = [5, 10, 25, 50, 100];

export function ChipPicker({ value, onChange, disabled, label }: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <fieldset className="chip-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div className="chip-row">
        {VALUES.map((amount) => (
          <button key={amount} type="button" className="play-chip" aria-pressed={value === amount}
            aria-label={`${amount} chips`} onClick={() => onChange(amount)}>
            {amount}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
