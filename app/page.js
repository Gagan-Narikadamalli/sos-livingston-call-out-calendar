'use client';
import {useEffect,useState} from 'react';
import Brand from './components/Brand';
import {
   apiRequest
}
 from '../lib/client-api';
import {
   earliestAdvanceDate
}
 from '../lib/validate';
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
    const [holidayDates,setHolidayDates]=useState([]);
    const [holidayLoading,setHolidayLoading]=useState(false);
    const [holidayCheckError,setHolidayCheckError]=useState('');
    const minimumPtoDate = getMinimumPtoDate();
    const reasonRequired = form.request_type === 'Non-PTO / Out';
    const dateMinimum = form.request_type === 'PTO' || form.request_type === '1/2 Day PTO' ? minimumPtoDate : undefined;
    const holidayRange=getFormDateRange(form);
    const holidayRangeStart=holidayRange?.start||'';
    const holidayRangeEnd=holidayRange?.end||'';

    useEffect(()=>{
        let active=true;
        if(!holidayRangeStart||!holidayRangeEnd){
            setHolidayDates([]);
            setHolidayLoading(false);
            setHolidayCheckError('');
            return ()=>{active=false};
        }
        setHolidayLoading(true);
        setHolidayCheckError('');
        apiRequest('/api/holidays?start='+holidayRangeStart+'&end='+holidayRangeEnd)
            .then(data=>{if(active)setHolidayDates(data.dates||[])})
            .catch(error=>{if(active)setHolidayCheckError(error.message||'Could not check holiday dates.')})
            .finally(()=>{if(active)setHolidayLoading(false)});
        return ()=>{active=false};
    },[holidayRangeStart,holidayRangeEnd]);

    const selectedHolidayDates=form.date_mode==='multiple'
        ?holidayDates.filter(date=>form.selected_dates.includes(date))
        :form.date_mode==='range'
            ?holidayDates.filter(date=>date>=form.range_start&&date<=form.range_end)
            :form.event_date&&holidayDates.includes(form.event_date)
                ?[form.event_date]
                :[];
    function updateForm(changes) {
        setForm((current) => ({ ...current, ...changes
}));
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
            updateForm({ selected_dates: [...form.selected_dates, '']
});
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
        if(holidayLoading){
            setMessage('Checking the selected dates for holidays. Please wait.');
            return;
        }
        if(holidayCheckError){
            setMessage('Holiday dates could not be verified. Please try again.');
            return;
        }
        if(selectedHolidayDates.length){
            setMessage('Holiday dates cannot be requested: '+selectedHolidayDates.join(', ')+'. Choose different dates.');
            return;
        }
        setBusy(true);
        setMessage('');
        try {
            const data = await apiRequest('/api/callouts', {
                method: 'POST',
                headers: { 'content-type': 'application/json'
},
                body: JSON.stringify(form),
});
            const suffix = data.created === 1 ? '' : 's';
            setMessage(`${data.created} PTO or leave date${suffix} submitted successfully.`);
            setForm(EMPTY_FORM);
}
     catch (error) {
            setMessage(error.message);
}
     finally {
            setBusy(false);
}
}
    return (
      <>
        <header>
          <Brand subtitle="Livingston PTO & Leave Request Portal" />
          <nav className="portal-links">
            <a className="link" href="/calendar">Livingston Calendar</a>
            <a className="link" href="/manager">Livingston Manager Calendar</a>
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
          <form className="card form" onSubmit={submit
}>
            <Field label="Employee name">
              <input
                required
                autoComplete="name"
                placeholder="Enter your full name"
                value={form.name
}
                onChange={(event) => updateForm({ name: event.target.value
})
}
              />
            </Field>
            <Field label="Employee email">
              <input
                required
                type="email"
                autoComplete="email"
                placeholder="Enter your work email"
                value={form.email
}
                onChange={(event) => updateForm({ email: event.target.value
})
}
              />
              <small className="muted">
                Your email is stored with the request so managers can identify who submitted it.
              </small>
            </Field>
            <Field label="Request type">
              <select
                value={form.request_type
}
                onChange={(event) => updateForm({ request_type: event.target.value
})
}
              >
                <option value="PTO">PTO (if available)</option>
                 <option value="1/2 Day PTO">1/2 Day PTO</option>
                <option value="Non-PTO / Out">Non-PTO / Out</option>
              </select>
              <small className="muted">
                PTO and 1/2 Day PTO dates must be at least two calendar days after today.
              </small>
            </Field>
            <Field label="Date selection">
              <select
                value={form.date_mode
}
                onChange={(event) => updateForm({ date_mode: event.target.value
})
}
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
                    min={dateMinimum
}
                    value={form.event_date
}
                    onChange={(event) => updateForm({ event_date: event.target.value
})
}
                  />
                </Field>
              )
}
            {form.date_mode === 'multiple' && (
                <div className="wide date-section">
                  <b>Requested dates</b>
                  {form.selected_dates.map((date, index) => (
                      <div className="date-row" key={index
}>
                        <input
                          required
                          aria-label={`Requested date ${index + 1}`
}
                          type="date"
                          min={dateMinimum
}
                          value={date
}
                          onChange={(event) => updateSelectedDate(index, event.target.value)
}
                        />
                        {form.selected_dates.length > 2 && (
                            <button
                              type="button"
                              className="secondary small-button"
                              onClick={() => removeSelectedDate(index)
}
                            >
                              Remove
                            </button>
                          )
}
                      </div>
                    ))
}
                  <button
                    type="button"
                    className="secondary add-date"
                    onClick={addSelectedDate
}
                  >
                    + Add another date
                  </button>
                </div>
              )
}
            {form.date_mode === 'range' && (
                <>
                  <Field label="Start date">
                    <input
                      required
                      type="date"
                      min={dateMinimum
}
                      value={form.range_start
}
                      onChange={(event) => updateForm({ range_start: event.target.value
})
}
                    />
                  </Field>
                  <Field label="End date">
                    <input
                      required
                      type="date"
                      min={form.range_start || dateMinimum
}
                      value={form.range_end
}
                      onChange={(event) => updateForm({ range_end: event.target.value
})
}
                    />
                  </Field>
                </>
              )
}
            <div className="wide">
              <Field label={`Reason or details${reasonRequired ? ' (required)' : ' (optional)'}`
}>
                <textarea
                  required={reasonRequired
}
                  placeholder={
                      reasonRequired
                        ? 'Briefly explain the time away.'
                        : 'Optional details for the manager.'
}
                  value={form.reason
}
                  onChange={(event) => updateForm({ reason: event.target.value
})
}
                />
              </Field>
              <p className="muted">
                Submission details, employee email, and submission time are available only to authorized managers.
              </p>
              {holidayLoading&&<p className="muted">Checking selected dates for holidays…</p>}
              {holidayCheckError&&<p className="holiday-warning">Holiday dates could not be checked. Please try again before submitting.</p>}
              {selectedHolidayDates.length>0&&<p className="holiday-warning">Holiday dates are unavailable: {selectedHolidayDates.join(', ')}. Remove those dates or choose different dates.</p>}
              <p className="request-notice">
                <strong>This is only a request and is still pending manager approval.</strong>
              </p>
              {message && <p className="message">{message
}</p>
}
              <button disabled={busy||holidayLoading||!!holidayCheckError||selectedHolidayDates.length>0}>{busy ? 'Submitting…' : 'Submit request'}</button>
            </div>
          </form>
        </main>
      </>
    );
}
function getFormDateRange(form){
    if(form.date_mode==='range'){
        return form.range_start&&form.range_end
            ?{start:form.range_start,end:form.range_end}
            :null;
    }
    const dates=form.date_mode==='multiple'
        ?form.selected_dates.filter(Boolean)
        :form.event_date?[form.event_date]:[];
    const sorted=[...dates].sort();
    return sorted.length?{start:sorted[0],end:sorted[sorted.length-1]}:null;
}

function getMinimumPtoDate() {
    return earliestAdvanceDate();
}
function Field({ label, children
}) {
    return (
      <label className="field">
        <b>{label
}</b>
        {children
}
      </label>
    );
}
