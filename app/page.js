'use client';

import { useState } from 'react';
import Brand from './components/Brand';

const EMPTY_FORM = {
  submitter_type: 'Employee',
  name: '',
  email: '',
  request_type: 'PTO',
  date_mode: 'single',
  event_date: '',
  selected_dates: ['', ''],
  range_start: '',
  range_end: '',
  reason: '',
};

export default function Home() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const minimumPtoDate = getMinimumPtoDate();
  const reasonRequired = form.request_type === 'Non-PTO / Out';
  const dateMinimum = form.request_type === 'PTO' || form.request_type === '1/2 Day PTO' ? minimumPtoDate : undefined;

  function updateForm(changes) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function updateSelectedDate(index, value) {
    updateForm({
      selected_dates: form.selected_dates.map((date, currentIndex) =>
        currentIndex === index ? value : date,
      ),
    });
  }

  function addSelectedDate() {
    if (form.selected_dates.length < 31) {
      updateForm({ selected_dates: [...form.selected_dates, ''] });
    }
  }

  function removeSelectedDate(index) {
    if (form.selected_dates.length > 2) {
      updateForm({
        selected_dates: form.selected_dates.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      });
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    const response = await fetch('/api/callouts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json();

    setBusy(false);
    if (!response.ok) {
      setMessage(data.error);
      return;
    }

    const suffix = data.created === 1 ? '' : 's';
    setMessage(`${data.created} PTO or leave date${suffix} submitted successfully.`);
    setForm(EMPTY_FORM);
  }

  return (
    <>
      <header>
        <Brand subtitle="Livingston PTO & Leave Request Portal" />
        <nav className="portal-links">
          <a className="link" href="/calendar">Livingston call-out calendar</a>
          <a className="link" href="/manager">Manager calendar</a>
        </nav>
      </header>

      <section className="hero">
        <div>
          <label>SUCCESS ON THE SPECTRUM · LIVINGSTON</label>
          <h1>Submit a PTO or leave request</h1>
          <p>Employees can request PTO or report non-PTO time away for one or more dates.</p>
        </div>
      </section>

      <main>
        <form className="card form" onSubmit={submit}>
          <Field label="Employee name">
            <input
              required
              autoComplete="name"
              placeholder="Enter your full name"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
            />
          </Field>

          <Field label="Employee email">
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="Enter your work email"
              value={form.email}
              onChange={(event) => updateForm({ email: event.target.value })}
            />
            <small className="muted">
              Your email is stored with the request so managers can identify who submitted it.
            </small>
          </Field>

          <Field label="Request type">
            <select
              value={form.request_type}
              onChange={(event) => updateForm({ request_type: event.target.value })}
            >
              <option value="PTO">PTO (if available)</option>
               <option value="1/2 Day PTO">1/2 Day PTO</option>
              <option value="Non-PTO / Out">Non-PTO / Out</option>
            </select>
            <small className="muted">
              PTO and 1/2 PTO dates must be at least two calendar days after today.
            </small>
          </Field>

          <Field label="Date selection">
            <select
              value={form.date_mode}
              onChange={(event) => updateForm({ date_mode: event.target.value })}
            >
              <option value="single">Single date</option>
              <option value="multiple">Multiple selected dates</option>
              <option value="range">Date range</option>
            </select>
          </Field>

          {form.date_mode === 'single' && (
            <Field label="Requested date">
              <input
                required
                type="date"
                min={dateMinimum}
                value={form.event_date}
                onChange={(event) => updateForm({ event_date: event.target.value })}
              />
            </Field>
          )}

          {form.date_mode === 'multiple' && (
            <div className="wide date-section">
              <b>Requested dates</b>
              {form.selected_dates.map((date, index) => (
                <div className="date-row" key={index}>
                  <input
                    required
                    aria-label={`Requested date ${index + 1}`}
                    type="date"
                    min={dateMinimum}
                    value={date}
                    onChange={(event) => updateSelectedDate(index, event.target.value)}
                  />
                  {form.selected_dates.length > 2 && (
                    <button
                      type="button"
                      className="secondary small-button"
                      onClick={() => removeSelectedDate(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="secondary add-date"
                onClick={addSelectedDate}
              >
                + Add another date
              </button>
            </div>
          )}

          {form.date_mode === 'range' && (
            <>
              <Field label="Start date">
                <input
                  required
                  type="date"
                  min={dateMinimum}
                  value={form.range_start}
                  onChange={(event) => updateForm({ range_start: event.target.value })}
                />
              </Field>
              <Field label="End date">
                <input
                  required
                  type="date"
                  min={form.range_start || dateMinimum}
                  value={form.range_end}
                  onChange={(event) => updateForm({ range_end: event.target.value })}
                />
              </Field>
            </>
          )}

          <div className="wide">
            <Field label={`Reason or details${reasonRequired ? ' (required)' : ' (optional)'}`}>
              <textarea
                required={reasonRequired}
                placeholder={
                  reasonRequired
                    ? 'Briefly explain the time away.'
                    : 'Optional details for the manager.'
                }
                value={form.reason}
                onChange={(event) => updateForm({ reason: event.target.value })}
              />
            </Field>

            <p className="muted">
              Submission details, employee email, and submission time are available only to authorized managers.
            </p>
            <p className="request-notice">
              <strong>This is only a request and is still pending manager approval.</strong>
            </p>

            {message && <p className="message">{message}</p>}
            <button disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button>
          </div>
        </form>
      </main>
    </>
  );
}

function getMinimumPtoDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 2);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Field({ label, children }) {
  return (
    <label className="field">
      <b>{label}</b>
      {children}
    </label>
  );
}
