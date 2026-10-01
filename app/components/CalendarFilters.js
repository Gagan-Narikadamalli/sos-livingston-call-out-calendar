'use client';

import {useState} from 'react';

const OPTIONS = [
  {value: 'manager', label: 'Manager Note'},
  {value: 'employee', label: 'Employee Note'},
  {value: 'client', label: 'Client Note'},
  {value: 'new', label: 'New Note'},
];

export default function CalendarFilters({value, onChange}) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((option) => option.value === value);

  return (
    <div className="calendar-filter">
      <button
        type="button"
        className={`filter-trigger${value ? ' active' : ''}`}
        aria-expanded={open}
        aria-label="Filter calendar notes"
        title="Filter calendar notes"
        onClick={() => setOpen((visible) => !visible)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 5h18l-7 8v5.5l-4 2V13L3 5Z" />
        </svg>
        <span>{current ? current.label : 'Filter'}</span>
      </button>

      {open && (
        <div className="filter-popover" role="menu" aria-label="Calendar filters">
          <div className="filter-popover-head">
            <strong>Filter calendar</strong>
            {value && (
              <button
                type="button"
                className="filter-clear"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
          {OPTIONS.map((option) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              className={`filter-option${value === option.value ? ' selected' : ''}`}
              key={option.value}
              onClick={() => {
                onChange(value === option.value ? '' : option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {value === option.value && <b>✓</b>}
            </button>
          ))}
          <small>Click the active filter again to show everything.</small>
        </div>
      )}
    </div>
  );
}
