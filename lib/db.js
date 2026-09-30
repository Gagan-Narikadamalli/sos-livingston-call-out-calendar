import postgres from 'postgres';
let sql;
let ready;
function client() {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    return globalThis.__sosSql || (globalThis.__sosSql = postgres(url, { ssl: 'require', max: 5
}));
}
async function hasColumn(database, table, column) {
    const rows = await database`
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = ${table} and column_name = ${column}
    limit 1
  `;
    return rows.length > 0;
}
async function copyLegacyColumn(database, table, destination, candidates) {
    for (const candidate of candidates) {
        if (await hasColumn(database, table, candidate)) {
            await database.unsafe(
              `update "${table}" set "${destination}" = "${candidate}" where "${destination}" is null and "${candidate}" is not null`,
            );
            return;
}
}
}
async function relaxLegacyColumns(database, table, columns) {
    for (const column of columns) {
        if (await hasColumn(database, table, column)) {
            await database.unsafe(`alter table "${table}" alter column "${column}" drop not null`);
}
}
}
async function prepareCallOuts(database) {
    await database`create table if not exists call_outs(id bigserial primary key,submitter_type text,name text,email text,request_type text,event_date date,reason text,request_group_id text,submitted_at timestamptz default now())`;
    await database`alter table call_outs add column if not exists submitter_type text`;
    await database`alter table call_outs add column if not exists name text`;
    await database`alter table call_outs add column if not exists email text`;
    await database`alter table call_outs add column if not exists request_type text`;
    await database`alter table call_outs add column if not exists event_date date`;
    await database`alter table call_outs add column if not exists reason text`;
    await database`alter table call_outs add column if not exists request_group_id text`;
    await database`alter table call_outs add column if not exists submitted_at timestamptz default now()`;
    await copyLegacyColumn(database, 'call_outs', 'submitter_type', ['submitted_by', 'submitter', 'role']);
    await copyLegacyColumn(database, 'call_outs', 'name', ['person_name', 'employee_name', 'full_name']);
    await copyLegacyColumn(database, 'call_outs', 'request_type', ['absence_type', 'type']);
    await copyLegacyColumn(database, 'call_outs', 'event_date', ['absence_date', 'callout_date', 'date']);
    await copyLegacyColumn(database, 'call_outs', 'submitted_at', ['created_at']);
    // The first version used different required column names. Keep those columns
    // for backwards compatibility, but do not let them reject current inserts.
    await relaxLegacyColumns(database, 'call_outs', [
      'submitted_by', 'submitter', 'role', 'person_name', 'employee_name',
      'full_name', 'absence_type', 'type', 'absence_date', 'callout_date',
      'date', 'created_at', 'reason',
    ]);
    await database`
    update call_outs set
      submitter_type = coalesce(submitter_type, 'Employee'),
      name = coalesce(name, 'Unknown'),
      request_type = coalesce(request_type, 'Called Out'),
      event_date = coalesce(event_date, submitted_at::date, current_date),
      submitted_at = coalesce(submitted_at, now())
    where submitter_type is null or name is null or request_type is null or event_date is null or submitted_at is null
  `;
    await database`create index if not exists call_outs_event_date_idx on call_outs(event_date)`;
}
async function prepareCalendarNotes(database) {
    await database`create table if not exists calendar_notes(id bigserial primary key,event_date date,title text,note_type text default 'Special note',note_category text default 'Manager Note',details text,created_at timestamptz default now(),updated_at timestamptz default now())`;
    await database`alter table calendar_notes add column if not exists event_date date`;
    await database`alter table calendar_notes add column if not exists title text`;
    await database`alter table calendar_notes add column if not exists note_type text default 'Special note'`;
    await database`alter table calendar_notes add column if not exists note_category text default 'Manager Note'`;
    await database`alter table calendar_notes add column if not exists details text`;
    await database`alter table calendar_notes add column if not exists created_at timestamptz default now()`;
    await database`alter table calendar_notes add column if not exists updated_at timestamptz default now()`;
    await database`update calendar_notes set note_category='Parent/Client Note' where note_category='Parent Note'`;
    await copyLegacyColumn(database, 'calendar_notes', 'event_date', ['note_date', 'date']);
    await copyLegacyColumn(database, 'calendar_notes', 'title', ['person_name', 'name']);
    await copyLegacyColumn(database, 'calendar_notes', 'note_type', ['type']);
    await copyLegacyColumn(database, 'calendar_notes', 'details', ['note', 'reason']);
    await relaxLegacyColumns(database, 'calendar_notes', [
      'note_date', 'date', 'person_name', 'name', 'type', 'note', 'reason', 'details',
    ]);
    await database`
    update calendar_notes set
      event_date = coalesce(event_date, created_at::date, current_date),
      title = coalesce(title, 'Manager note'),
      note_type = coalesce(note_type, 'Special note'),
      note_category = coalesce(note_category, 'Manager Note'),
      created_at = coalesce(created_at, now()),
      updated_at = coalesce(updated_at, created_at, now())
    where event_date is null or title is null or note_type is null or note_category is null or created_at is null or updated_at is null
  `;
    await database`create index if not exists calendar_notes_event_date_idx on calendar_notes(event_date)`;
}
export async function db() {
    sql = sql || client();
    if (!ready) {
        ready = (async () => {
            // Multiple serverless functions can start at once. A transaction-scoped
            // advisory lock prevents concurrent schema migrations/index creation.
            await sql.begin(async (transaction) => {
                await transaction`select pg_advisory_xact_lock(734682901)`;
                await prepareCallOuts(transaction);
                await prepareCalendarNotes(transaction);
});
})().catch((error) => {
            ready = undefined;
            throw error;
});
}
    await ready;
    return sql;
}
