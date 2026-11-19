export async function writeAudit(sql,{action,entityType,entityId=null,summary,details={},undoData=null}){
 await sql`insert into calendar_audit_log(action,entity_type,entity_id,summary,details,undo_data)
 values(${action},${entityType},${entityId===null?null:String(entityId)},${summary},${sql.json(details||{})},${undoData===null?null:sql.json(undoData)})`;
}
