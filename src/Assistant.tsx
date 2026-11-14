import {useState} from 'react'
import {Bot, Send} from 'lucide-react'
import {applyDraft, fields, labels, loadHistory, localAssistant, saveHistory, unresolved, type Draft} from './assistantService'
import {Panel,Field,Badge} from './ui'
import {day,now,type Data} from './demo'
import './assistant.css'

type Message = {speaker:'You'|'Assistant'; text:string; draftId?:string}
const welcome:Message = {speaker:'Assistant',text:'Ask about your demo records in English or Roman Urdu. I can prepare a draft, and you choose whether to approve it.'}
const examples = ['Show me low-stock items.', 'Add ABC Traders as a supplier in Karachi.', 'Customer ka outstanding balance dikhao.']

export function Assistant({data,commit}:{data:Data;commit:(work:(draft:Data)=>string)=>string}) {
  const [history,setHistory] = useState(loadHistory)
  const [messages,setMessages] = useState<Message[]>([welcome])
  const [input,setInput] = useState('')
  const [view,setView] = useState('Chat')
  const [filter,setFilter] = useState('All')
  const [followup,setFollowup] = useState('')
  const [error,setError] = useState('')
  function update(id:string,patch:Partial<Draft>) {
    const next=loadHistory().map(d=>d.id===id?{...d,...patch}:d)
    saveHistory(next)
    setHistory(next)
  }
  function send(text:string) {
    text=text.trim()
    if(!text)return
    const continuation = followup && !/^(show|add|create|post|sell|receive|record|list|check|return)\b/i.test(text)
    const request = continuation ? followup+' '+text : text
    const reply = localAssistant.understand(request,data)
    setFollowup(!reply.draft && /^(Which|Should)/.test(reply.message)?request:'')
    if(reply.draft) {
      const next=[reply.draft,...loadHistory()]
      saveHistory(next)
      setHistory(next)
    }
    setMessages(old=>[...old,{speaker:'You',text},{speaker:'Assistant',text:reply.message,draftId:reply.draft?.id}])
    setInput('')
    setError('')
  }
  function approve(draft:Draft) {
    setError('')
    if(loadHistory().find(d=>d.id===draft.id)?.status!=='Pending') {setHistory(loadHistory());return}
    try {
      const result=commit(current=>applyDraft(current,draft))
      update(draft.id,{status:'Approved',result})
      setMessages(old=>[...old,{speaker:'Assistant',text:result}])
    } catch(e) {
      setError(e instanceof Error?e.message:'Unable to apply this draft.')
    }
  }
  function card(draft:Draft) {
    const missing=unresolved(data,draft)
    const values=fields(data,draft.action,draft.values)
    const dateField=['purchase','receipt','sale','payment','return'].includes(draft.action)
    return <section className="assistant-draft" key={draft.id} aria-label={labels[draft.action]}>
      <div className="assistant-draft-head"><strong>{labels[draft.action]}</strong><Badge label={draft.status}/></div>
      <p>{draft.text}</p>
      {draft.status==='Pending'?<>
        <div className="assistant-fields">{values.map(f=><Field key={f.key} label={f.label}>{f.options?
          <select value={f.options.some(o=>o.id===draft.values[f.key])?draft.values[f.key]:''} onChange={e=>update(draft.id,{values:{...draft.values,[f.key]:e.target.value}})}>
            <option value="">Select {f.label.toLowerCase()}</option>{f.options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
          </select>:<input type={f.number?'number':'text'} step={f.number?'any':undefined} min={f.number?0:undefined} value={draft.values[f.key]??''} onChange={e=>update(draft.id,{values:{...draft.values,[f.key]:e.target.value}})}/>}</Field>)}</div>
        {dateField&&<p>Posting date and time use approval time in Asia/Karachi ({day(now())}). Taxes and totals follow the existing demo settings.</p>}
        {draft.action==='purchase'&&<p>A purchase order adds no stock. Approve and receive it in Purchasing when goods arrive.</p>}
        {draft.action==='receipt'&&<p>Enter accepted quantities in the catalogue unit. Unit conversions are unavailable.</p>}
        {draft.action==='sale'&&<p>A matched item uses its catalogue price when no price is supplied. Review the price and settlement before approval.</p>}
        {missing.length>0&&<p className="assistant-warning">Needs confirmation · {missing.map(f=>f.label).join(', ')}</p>}
        <div className="assistant-actions">
          <button className="secondary" onClick={()=>{update(draft.id,{status:'Cancelled'});setError('')}}>Cancel draft</button>
          <button className="secondary" onClick={()=>{update(draft.id,{status:'Rejected'});setError('')}}>Reject</button>
          <button className="primary" disabled={missing.length>0} onClick={()=>approve(draft)}>Approve &amp; Add</button>
        </div>
      </>:<p>{draft.result??'No business change applied.'}</p>}
    </section>
  }
  return <div className="assistant-page">
    <Panel title="Demo AI Assistant" note="Local intent parsing · Fictional data · English and Roman Urdu" action={<Bot size={24}/>}>
      <div className="assistant-tabs" aria-label="Assistant views">{['Chat','Draft history'].map(tab=><button key={tab} className={tab===view?'primary':'secondary'} aria-pressed={tab===view} onClick={()=>{setView(tab);setError('')}}>{tab}</button>)}</div>
      {error&&<p className="error" role="alert">{error}</p>}
      {view==='Chat'?<>
        <div className="assistant-messages" aria-live="polite">{messages.map((m,i)=><div className={'assistant-message '+(m.speaker==='You'?'assistant-user':'')} key={i}>
          <strong>{m.speaker}</strong><p>{m.text}</p>
          {m.draftId&&history.filter(d=>d.id===m.draftId).map(card)}
        </div>)}</div>
        <div className="assistant-examples">{examples.map(text=><button key={text} className="secondary" onClick={()=>send(text)}>{text}</button>)}</div>
        <form className="assistant-composer" onSubmit={e=>{e.preventDefault();send(input)}}>
          <Field label="Message"><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask a question or request a draft" required/></Field>
          <button className="primary"><Send size={16}/> Send</button>
        </form>
      </>:<div className="assistant-history">
        <Field label="Draft status"><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Pending','Approved','Rejected','Cancelled'].map(s=><option key={s}>{s}</option>)}</select></Field>
        {history.some(d=>filter==='All'||d.status===filter)?history.filter(d=>filter==='All'||d.status===filter).map(card):<p className="empty">No drafts match this status.</p>}
      </div>}
    </Panel>
  </div>
}


