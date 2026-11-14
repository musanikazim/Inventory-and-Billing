import type { ReactNode } from 'react'
import { locations, type Data, type Document } from './demo'

export const warehouse = (id:string) => locations.find(l=>l.id===id)?.name ?? '—'
export const partyName = (data:Data,id:string) => data.parties.find(p=>p.id===id)?.name ?? '—'
export const itemName = (data:Data,id:string) => data.products.find(p=>p.id===id)?.name ?? '—'
export const documentName = (doc:Document) => ({Purchase:'Purchase order',Sale:'Sales invoice',Return:'Credit note'}[doc.kind])
const tones:Record<string,string> = {Settled:'green',Posted:'blue',Approved:'blue','Awaiting approval':'amber','Part received':'amber','Part paid':'amber','Low stock':'amber','Out of stock':'red','In stock':'green',Refunded:'purple',Credited:'purple','Customer credit':'purple',Received:'green'}

export function Badge({label}:{label:string}) { return <span className={'badge '+(tones[label]??'blue')}><i/>{label}</span> }
export function Panel({title,note,action,children}:{title:string;note?:string;action?:ReactNode;children:ReactNode}) {
  return <section className="panel"><header className="panel-head"><div><h2>{title}</h2>{note&&<p>{note}</p>}</div>{action}</header>{children}</section>
}
export function Table({headers,rows}:{headers:string[];rows:ReactNode[][]}) {
  return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="empty">No matching records.</p>}</div>
}
export function Field({label,children}:{label:string;children:ReactNode}) {return <label className="field"><span>{label}</span>{children}</label>}

