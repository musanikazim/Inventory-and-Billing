import {useEffect,useState,type ReactNode} from 'react'
import {X,Plus,ArrowRight,ChevronRight} from 'lucide-react'
import {balance,createDocument,day,documentStatus,locations,money,partyBalance,receive,recordPayment,recordReturn,returnable,totalLines,updateProduct,type Data,type Line} from './demo'
import {Badge,Table,Field,warehouse,partyName,itemName,documentName} from './ui'

const titles = {purchase:'New purchase order',sale:'New sale',receive:'Receive purchase order',payment:'Record payment',return:'New sales return',preview:'Document preview',statement:'Party statement',item:'Add catalogue item',deleteItem:'Delete catalogue item',party:'Add trading partner',reset:'Reset Demo Data',search:'Search workspace',guide:'Demo walkthrough'}
export type Dialog = {type:keyof typeof titles;id?:string}
type Props = {dialog:Dialog;data:Data;error:string;close:()=>void;change:(work:(d:Data)=>void,message:string,keep?:boolean)=>void;open:(type:Dialog['type'],id?:string)=>void;pages:string[];canEditDocuments:boolean;searchableDocs:Data['docs'];navigate:(p:string)=>void;reset:()=>void}
const str=(f:FormData,key:string)=>String(f.get(key)??'').trim()
const number=(f:FormData,key:string)=>Number(f.get(key))
function Options({values}:{values:string[]}) { return <>{values.map(x=><option key={x}>{x}</option>)}</> }

export function Workflow({dialog,data,error,close,change,open,pages,canEditDocuments,searchableDocs,navigate,reset}:Props) {
  const {type,id}=dialog
  const [element,setElement]=useState<HTMLDialogElement|null>(null)
  useEffect(()=>{if(element&&!element.open)element.showModal()},[element])
  const doc=data.docs.find(d=>d.id===id)
  const catalogueItem=data.products.find(p=>p.id===id)
  const itemInUse=(records:Data)=>records.moves.some(m=>m.item===id)||records.docs.some(d=>d.lines.some(l=>l.item===id))
  const party=data.parties.find(p=>p.id===id)
  const purchase=type==='purchase'
  const invoices=data.docs.filter(d=>d.kind==='Sale'&&d.lines.some(l=>returnable(data,d,l.item)>0))
  const payable=data.docs.filter(d=>(d.kind==='Sale'||(d.kind==='Purchase'&&d.status==='Received'))&&balance(data,d)>0)
  const [selected,setSelected]=useState(id??((type==='payment'?payable:invoices)[0]?.id??''))
  const target=data.docs.find(d=>d.id===selected)
  const [lines,setLines]=useState<Line[]>([{item:'',qty:1,price:0}])
  const [tender,setTender]=useState('Credit sale')
  const [item,setItem]=useState('')
  const [search,setSearch]=useState('')
  const eligible=target?[...new Set(target.lines.map(l=>l.item))].filter(i=>returnable(data,target,i)>0):[]
  const returnItem=eligible.includes(item)?item:eligible[0]??''
  const subtotal=totalLines(lines)
  const tax=Math.round(subtotal*data.tax)/100
  const buttons=(label:string)=><div className="dialog-actions"><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary">{label}</button></div>
  const form=(submit:(f:FormData)=>void,children:ReactNode)=><form className="form" onSubmit={e=>{e.preventDefault();submit(new FormData(e.currentTarget))}}>{children}</form>
  const method=<Field label="Payment method"><select name="method"><Options values={['Cash','Bank transfer','Card (simulated)','Digital wallet (simulated)']}/></select></Field>
  const editLine=(index:number,patch:Partial<Line>)=>setLines(lines.map((l,i)=>i===index?{...l,...patch}:l))
  const totals=(subtotal:number,tax:number,total:number)=><div className="totals"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Demo tax</span><b>{money(tax)}</b></div><div><span>Total</span><strong>{money(total)}</strong></div></div>
  const printActions=(label:string)=><div className="dialog-actions"><button className="secondary" onClick={close}>Close</button><button className="primary" onClick={()=>window.print()}>{label}</button></div>
  return <dialog ref={setElement} className={'dialog '+(['preview','statement'].includes(type)?'printable':'')} aria-labelledby="dialog-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget)close()}}>
    <div className="dialog-wrap"><div className="dialog-head"><h2 id="dialog-title">{type==='item'&&id?'Edit catalogue item':titles[type]}</h2><button className="icon" aria-label="Close dialog" onClick={close}><X size={21}/></button></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {(purchase||type==='sale')&&form(f=>change(d=>{createDocument(d,purchase?'Purchase':'Sale',str(f,'party'),str(f,'warehouse'),lines,tender==='Pay now',str(f,'method'))},purchase?'Purchase order created.':'Sale posted. Stock and balances updated.'),<>
      <div className="form-grid"><Field label={purchase?'Supplier':'Customer'}><select name="party" required>{data.parties.filter(p=>p.type===(purchase?'Supplier':'Customer')).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Warehouse"><select name="warehouse">{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field></div>
      {lines.map((l,i)=><div className="line-form" key={i}><Field label="Item"><select required value={l.item} onChange={e=>{const p=data.products.find(x=>x.id===e.target.value);editLine(i,{item:p?.id??'',price:purchase?Math.round((p?.price??0)*.72):p?.price??0})}}><option value="">Choose item</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></Field><Field label="Qty"><input type="number" min="1" step="1" required value={l.qty||''} onChange={e=>editLine(i,{qty:Number(e.target.value)})}/></Field><Field label="Unit price"><input type="number" min="0" step=".01" required value={l.price} onChange={e=>editLine(i,{price:Number(e.target.value)})}/></Field><button className="icon" type="button" aria-label={'Remove item '+(i+1)} disabled={lines.length===1} onClick={()=>setLines(lines.filter((_,j)=>i!==j))}><X size={17}/></button></div>)}
      <button type="button" className="link" onClick={()=>setLines([...lines,{item:'',qty:1,price:0}])}><Plus size={16}/> Add line</button>
      {!purchase&&<div className="form-grid"><Field label="Settlement"><select value={tender} onChange={e=>setTender(e.target.value)}><Options values={['Credit sale','Pay now']}/></select></Field>{tender==='Pay now'&&method}</div>}
      {totals(subtotal,tax,subtotal+tax)}{buttons(purchase?'Create purchase order':'Post sale')}
    </>)}
    {type==='receive'&&doc&&form(f=>change(d=>receive(d,doc.id,doc.lines.map((_,i)=>number(f,'qty'+i))),'Receipt posted. Inventory updated.'),<><p>{doc.id} · {warehouse(doc.location)}</p>{doc.lines.map((l,i)=><Field key={i} label={itemName(data,l.item)+' · '+(l.qty-doc.received[i])+' remaining'}><input name={'qty'+i} type="number" min="0" max={l.qty-doc.received[i]} step="1" required defaultValue={l.qty-doc.received[i]}/></Field>)}{buttons('Post receipt')}</>)}
    {type==='payment'&&(payable.length?form(f=>change(d=>recordPayment(d,selected,number(f,'amount'),str(f,'method')),'Payment recorded.'),<>
      <Field label="Open document"><select required value={selected} onChange={e=>setSelected(e.target.value)}>{payable.map(d=><option key={d.id} value={d.id}>{d.id} · {partyName(data,d.party)} · {money(balance(data,d))} due</option>)}</select></Field><div className="form-grid"><Field label="Amount (PKR)"><input key={selected} type="number" name="amount" min=".01" max={target?balance(data,target):undefined} step=".01" required defaultValue={target?balance(data,target):undefined}/></Field>{method}</div>{buttons('Record payment')}
    </>):<p className="empty">No open documents have an amount due.</p>)}
    {type==='return'&&(invoices.length?form(f=>change(d=>recordReturn(d,selected,returnItem,number(f,'qty'),str(f,'disposition'),str(f,'settlement')),'Return recorded. Stock and settlement updated.'),<>
      <Field label="Original invoice"><select value={selected} onChange={e=>{setSelected(e.target.value);setItem('')}}>{invoices.map(d=><option key={d.id} value={d.id}>{d.id} · {partyName(data,d.party)}</option>)}</select></Field>
      <div className="form-grid"><Field label="Item"><select value={returnItem} onChange={e=>setItem(e.target.value)}>{eligible.map(i=><option key={i} value={i}>{itemName(data,i)}</option>)}</select></Field><Field label={'Quantity · '+(target?returnable(data,target,returnItem):0)+' eligible'}><input name="qty" type="number" min="1" max={target?returnable(data,target,returnItem):0} step="1" required defaultValue="1"/></Field></div>
      <div className="form-grid"><Field label="Stock disposition"><select name="disposition"><Options values={['Restock as sellable','Scrap']}/></select></Field><Field label="Financial settlement"><select name="settlement"><Options values={['Credit note','Refund']}/></select></Field></div>{buttons('Post return')}
    </>):<p className="empty">No sales invoices have an eligible return quantity.</p>)}

    {type==='item'&&(!id||catalogueItem)&&form(f=>change(d=>{
      const sku=str(f,'sku').toUpperCase(), name=str(f,'name')
      if(!name||!sku||d.products.some(p=>p.id!==id&&p.sku.toUpperCase()===sku))throw Error('Enter an item name and a unique SKU.')
      const existing=d.products.find(p=>p.id===id)
      if(id&&!existing)throw Error('This item no longer exists.')
      const values={
        sku,name,category:str(f,'category')||'Uncategorised',
        unit:existing&&itemInUse(d)?existing.unit:str(f,'unit')||'Unit',
        price:number(f,'price'),reorder:number(f,'reorder'),
      }
      if(existing)updateProduct(d,existing.id,values)
      else d.products.push({id:crypto.randomUUID(),...values})
    },id?'Catalogue item updated.':'Catalogue item added.'),<>
      <div className="form-grid">
        <Field label="Item name"><input name="name" defaultValue={catalogueItem?.name} required/></Field>
        <Field label="SKU"><input name="sku" defaultValue={catalogueItem?.sku} required/></Field>
        <Field label="Category"><input name="category" defaultValue={catalogueItem?.category} required/></Field>
        <Field label="Unit"><input name="unit" defaultValue={catalogueItem?.unit} readOnly={!!id&&itemInUse(data)} required/></Field>
        <Field label="Selling price (PKR)"><input name="price" type="number" min="0" step=".01" defaultValue={catalogueItem?.price} required/></Field>
        <Field label="Reorder level"><input name="reorder" type="number" min="0" step="1" defaultValue={catalogueItem?.reorder} required/></Field>
      </div>
      {id&&itemInUse(data)&&<p>The unit is locked because stock or transaction records already use it.</p>}
      {buttons(id?'Save changes':'Add item')}
    </>)}
    {type==='deleteItem'&&catalogueItem&&<>
      <p className="body-copy">{itemInUse(data)
        ? catalogueItem.name+' is linked to stock movements or documents and cannot be deleted.'
        : 'Delete '+catalogueItem.name+' ('+catalogueItem.sku+') from the catalogue?'}</p>
      <div className="dialog-actions">
        <button className="secondary" onClick={close}>{itemInUse(data)?'Close':'Cancel'}</button>
        {!itemInUse(data)&&<button className="danger" onClick={()=>change(d=>{
          if(itemInUse(d))throw Error('This item is now linked to stock movements or documents.')
          d.products=d.products.filter(p=>p.id!==id)
        },'Catalogue item deleted.')}>Delete item</button>}
      </div>
    </>}
    {((type==='item'&&id)||type==='deleteItem')&&!catalogueItem&&<p className="empty">This item no longer exists.</p>}
    {type==='party'&&form(f=>change(d=>{
      const name=str(f,'name')
      if(!name)throw Error('Enter the trading partner name.')
      d.parties.push({id:crypto.randomUUID(),name,type:str(f,'type')==='Supplier'?'Supplier':'Customer',city:str(f,'city'),phone:str(f,'reference')})
    },'Trading partner added.'),<><div className="form-grid"><Field label="Name"><input name="name" required/></Field><Field label="Type"><select name="type"><Options values={['Customer','Supplier']}/></select></Field><Field label="City"><input name="city" required/></Field><Field label="Fictional contact reference"><input name="reference" placeholder="DEMO-006"/></Field></div>{buttons('Add trading partner')}</>)}
    {type==='preview'&&doc&&<>
      <div className="print-banner"><div><strong>Meridian Supply Co.</strong><small>{documentName(doc)} · Commercial demo document</small></div><div><b>{doc.id}</b><small>{day(doc.date)}</small></div></div>
      <dl className="details"><dt>Trading partner</dt><dd>{partyName(data,doc.party)}</dd><dt>Warehouse</dt><dd>{warehouse(doc.location)}</dd><dt>Status</dt><dd><Badge label={documentStatus(data,doc)}/></dd>{doc.source&&<><dt>Original invoice</dt><dd>{doc.source}</dd><dt>Stock disposition</dt><dd>{doc.disposition}</dd></>}</dl>
      <Table headers={['Item','Qty','Unit price','Amount',...(doc.kind==='Purchase'?['Received']:[])]} rows={doc.lines.map((l,i)=>[itemName(data,l.item),l.qty,money(l.price),money(l.qty*l.price),...(doc.kind==='Purchase'?[doc.received[i]]:[])])}/>{totals(doc.subtotal,doc.tax,doc.total)}
      {doc.kind==='Sale'&&<div className="simulation"><strong>FBR simulation</strong><p>{doc.submission??'Not submitted'} · Local demo state</p>{canEditDocuments&&doc.submission!=='Accepted (simulated)'&&<button className="secondary" onClick={()=>change(d=>{d.docs.find(x=>x.id===doc.id)!.submission=doc.submission?'Accepted (simulated)':'Queued (simulated)'},'Simulated submission state saved.',true)}>{doc.submission?'Simulate acceptance':'Simulate submission'}</button>}</div>}
      {printActions('Print document')}
    </>}
    {type==='statement'&&party&&<>
      <div className="print-banner"><div><strong>{party.name}</strong><small>{party.type} · {party.city}</small></div><div><b>{money(partyBalance(data,party.id))}</b><small>Net demo balance</small></div></div>
      <Table headers={['Reference','Date','Type','Amount','Open balance']} rows={[...data.docs.filter(d=>d.party===party.id&&(d.kind!=='Purchase'||d.status==='Received')).map(d=>[d.id,d.date,d.kind==='Purchase'?'Supplier payable':documentName(d),money(d.total),d.kind==='Return'?'—':money(balance(data,d))]),...data.payments.filter(p=>p.party===party.id).map(p=>[p.id,p.date,p.kind,money(p.amount),'—'])].sort((a,b)=>b[1].localeCompare(a[1])).map(r=>[r[0],day(r[1]),...r.slice(2)])}/>{printActions('Print statement')}
    </>}
    {type==='reset'&&<><p className="body-copy">Replace this browser’s records with the original fictional sample data?</p><div className="dialog-actions"><button className="secondary" onClick={close}>Cancel</button><button className="danger" onClick={reset}>Reset Demo Data</button></div></>}
    {type==='search'&&<div className="form"><Field label="Find a screen or document"><input autoFocus placeholder="Try Inventory or INV-0001" value={search} onChange={e=>setSearch(e.target.value)}/></Field><div className="search-results">
      {pages.filter(p=>p.toLowerCase().includes(search.toLowerCase())).map(p=><button key={p} onClick={()=>{navigate(p);close()}}>{p}<ChevronRight size={15}/></button>)}
      {search.trim()&&searchableDocs.filter(d=>(d.id+' '+partyName(data,d.party)).toLowerCase().includes(search.toLowerCase())).map(d=><button key={d.id} onClick={()=>open('preview',d.id)}>{d.id} · {partyName(data,d.party)}<ChevronRight size={15}/></button>)}
    </div></div>}
    {type==='guide'&&<div className="body-copy"><ol><li>Create or approve a purchase order, then receive goods.</li><li>Check stock and receipt movements in Inventory.</li><li>Post a credit sale and collect a payment against it.</li><li>Return an item and select its stock disposition and settlement.</li><li>Review the customer statement, reports and document previews.</li></ol><button className="primary" onClick={()=>{navigate('Purchasing');close()}}>Open purchasing <ArrowRight size={16}/></button></div>}
    </div>
  </dialog>
}
