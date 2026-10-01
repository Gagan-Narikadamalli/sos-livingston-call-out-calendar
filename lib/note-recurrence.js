export async function materializeRecurringNotesForMonth(sql, month) {
  const monthStart = `${month}-01`;
  const series = await sql`
    select *
    from note_recurrences
    where start_date < (${monthStart})::date + interval '1 month'
      and (end_date is null or end_date >= (${monthStart})::date)
      and (active = true or stopped_at >= (${monthStart})::date)
  `;

  const created = [];

  for (const item of series) {
    const allowedWeekdays = String(item.weekdays)
      .split(',')
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

    const firstOfMonth = new Date(`${monthStart}T00:00:00Z`);
    const lastOfMonth = new Date(
      Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0),
    );
    const seriesStart = new Date(`${String(item.start_date).slice(0, 10)}T00:00:00Z`);
    const seriesEnd = item.end_date
      ? new Date(`${String(item.end_date).slice(0, 10)}T00:00:00Z`)
      : null;

    for (
      const cursor = new Date(firstOfMonth);
      cursor <= lastOfMonth;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      if (cursor < seriesStart) continue;
      if (seriesEnd && cursor > seriesEnd) continue;
      if (!allowedWeekdays.includes(cursor.getUTCDay())) continue;

      const eventDate = cursor.toISOString().slice(0, 10);
      const rows = await sql`
        insert into calendar_notes(
          event_date,
          title,
          note_type,
          note_category,
          details,
          recurrence_id
        )
        select
          ${eventDate},
          ${item.title},
          ${item.note_type},
          ${item.note_category},
          ${item.details || ''},
          ${item.id}
        where not exists(
          select 1
          from calendar_notes
          where recurrence_id = ${item.id}
            and event_date = ${eventDate}
        )
        returning
          id,
          event_date::text,
          title,
          note_type,
          note_category,
          details,
          created_at,
          updated_at,
          recurrence_id
      `;
      created.push(...rows);
    }
  }

  return created;
}
