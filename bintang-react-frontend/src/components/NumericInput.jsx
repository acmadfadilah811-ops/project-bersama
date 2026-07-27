import { useState, useEffect, useRef } from 'react';

/**
 * Reusable numeric input component for easy number editing in React.
 * Solves common UX issues:
 * - Auto-selects text on focus so typing instantly replaces existing values (e.g. '0').
 * - Allows clearing the field completely (empty string) while typing without snapping back to 0.
 * - Prevents non-numeric letter keypresses.
 * - Supports integer or decimal numbers.
 * - Formats values with thousand separator dots (e.g. 1.000.000 or 10,5) for clear reading.
 */
export default function NumericInput({
  value,
  onChange,
  min,
  max,
  allowDecimal = false,
  formatThousand,
  placeholder = '0',
  className = '',
  disabled = false,
  onBlur: externalOnBlur,
  onFocus: externalOnFocus,
  ...props
}) {
  const inputRef = useRef(null);

  // Default formatThousand to true for all numeric inputs unless explicitly set to false
  const shouldFormat = formatThousand !== undefined ? formatThousand : true;

  const formatValue = (val) => {
    if (val === undefined || val === null || val === '') return '';
    if (!shouldFormat) return String(val);
    const str = String(val).replace(',', '.');
    if (allowDecimal && str.includes('.')) {
      const parts = str.split('.');
      const intClean = parts[0].replace(/\D/g, '');
      const formattedInt = intClean ? Number(intClean).toLocaleString('id-ID') : '0';
      const decClean = parts.slice(1).join('').replace(/\D/g, '');
      return `${formattedInt},${decClean}`;
    } else {
      const clean = str.replace(/\D/g, '');
      return clean ? Number(clean).toLocaleString('id-ID') : '';
    }
  };

  const [localVal, setLocalVal] = useState(() => formatValue(value));

  // Keep local state in sync when parent value changes, unless user is actively editing
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalVal(formatValue(value));
    }
  }, [value, shouldFormat]);

  const handleFocus = (e) => {
    // Select all text on focus so typing immediately overwrites the existing number
    e.target.select();
    if (externalOnFocus) externalOnFocus(e);
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    const inputEl = e.target;
    const caretPos = inputEl.selectionStart || 0;

    if (shouldFormat) {
      if (raw === '') {
        setLocalVal('');
        onChange(min !== undefined ? min : 0);
        return;
      }

      // Count digits before caret prior to formatting
      let digitsBeforeCaret = 0;
      for (let i = 0; i < caretPos; i++) {
        if (/\d/.test(raw[i])) {
          digitsBeforeCaret++;
        }
      }

      let formatted = '';
      let parsed;

      if (allowDecimal && (raw.includes('.') || raw.includes(','))) {
        const normalized = raw.replace(',', '.');
        const parts = normalized.split('.');
        const intClean = parts[0].replace(/\D/g, '');
        const decClean = parts.slice(1).join('').replace(/\D/g, '');
        const formattedInt = intClean ? Number(intClean).toLocaleString('id-ID') : '0';
        formatted = `${formattedInt},${decClean}`;
        parsed = parseFloat(`${intClean || '0'}.${decClean}`);
      } else {
        const cleanDigits = raw.replace(/\D/g, '');
        if (!cleanDigits) {
          setLocalVal('');
          onChange(min !== undefined ? min : 0);
          return;
        }
        parsed = allowDecimal ? parseFloat(cleanDigits) : parseInt(cleanDigits, 10);
        formatted = Number(cleanDigits).toLocaleString('id-ID');
      }

      if (isNaN(parsed)) parsed = 0;

      if (max !== undefined && parsed > max) {
        parsed = max;
        formatted = formatValue(max);
      }

      setLocalVal(formatted);
      onChange(parsed);

      // Restore cursor position seamlessly after DOM update
      requestAnimationFrame(() => {
        if (!inputEl) return;
        let newPos = 0;
        let count = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (/\d/.test(formatted[i])) {
            count++;
          }
          if (count === digitsBeforeCaret) {
            newPos = i + 1;
            break;
          }
        }
        if (count < digitsBeforeCaret) {
          newPos = formatted.length;
        }
        try {
          inputEl.setSelectionRange(newPos, newPos);
        } catch (err) {
          // ignore
        }
      });
    } else {
      // Filter characters
      let filtered;
      if (allowDecimal) {
        // Allow numbers and single decimal dot or comma (converted to dot)
        filtered = raw.replace(',', '.').replace(/[^0-9.]/g, '');
        const parts = filtered.split('.');
        if (parts.length > 2) {
          filtered = `${parts[0]}.${parts.slice(1).join('')}`;
        }
      } else {
        // Numbers only
        filtered = raw.replace(/[^0-9]/g, '');
      }

      setLocalVal(filtered);

      // Parse numeric value for parent callback
      if (filtered === '' || filtered === '.') {
        onChange(min !== undefined ? min : 0);
      } else {
        const parsed = allowDecimal ? parseFloat(filtered) : parseInt(filtered, 10);
        if (!isNaN(parsed)) {
          if (max !== undefined && parsed > max) {
            onChange(max);
          } else {
            onChange(parsed);
          }
        }
      }
    }
  };

  const handleBlur = (e) => {
    if (shouldFormat) {
      if (localVal === '') {
        const fallback = min !== undefined ? min : 0;
        setLocalVal(fallback ? formatValue(fallback) : '');
        onChange(fallback);
      } else {
        const rawStr = localVal.replace(/\./g, '').replace(',', '.');
        let parsed = allowDecimal ? parseFloat(rawStr) : parseInt(rawStr, 10);
        if (isNaN(parsed)) parsed = 0;

        if (min !== undefined && parsed < min) {
          parsed = min;
        } else if (max !== undefined && parsed > max) {
          parsed = max;
        }
        setLocalVal(formatValue(parsed));
        onChange(parsed);
      }
    } else {
      if (localVal === '' || localVal === '.') {
        const fallback = min !== undefined ? min : 0;
        setLocalVal(String(fallback));
        onChange(fallback);
      } else {
        const parsed = allowDecimal ? parseFloat(localVal) : parseInt(localVal, 10);
        if (!isNaN(parsed)) {
          if (min !== undefined && parsed < min) {
            setLocalVal(String(min));
            onChange(min);
          } else if (max !== undefined && parsed > max) {
            setLocalVal(String(max));
            onChange(max);
          } else {
            setLocalVal(String(parsed));
          }
        }
      }
    }
    if (externalOnBlur) externalOnBlur(e);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={localVal}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      {...props}
    />
  );
}
