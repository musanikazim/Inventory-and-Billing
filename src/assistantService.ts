import { balance, createDocument, day, locations, money, partyBalance, receive, recordPayment, recordReturn, returnable, stock, updateProduct, type Data } from './demo'
import type {Grant, Module} from './access'

const historyKey = 'blueledger-assistant-v1'
const userHistoryKey=(userId:string)=>userId==='demo-owner'?historyKey:historyKey+'-'+userId
export const loadHistory = (userId:string): Draft[] => JSON.parse(localStorage.getItem(userHistoryKey(userId)) ?? '[]')
export const saveHistory = (userId:string,drafts:Draft[]) => localStorage.setItem(userHistoryKey(userId),JSON.stringify(drafts))
export function resetAssistant() {
  for(const key of Object.keys(localStorage)) {
    if(key===historyKey||key.startsWith(historyKey+'-'))localStorage.removeItem(key)
  }
}

type Action = 'party' | 'item' | 'editItem' | 'purchase' | 'receipt' | 'sale' | 'payment' | 'return'
type Values = Record<string,string>
export type Draft = { id:string; text:string; action:Action; values:Values; status:'Pending'|'Approved'|'Rejected'|'Cancelled'; result?:string }
type Option = { id:string; name:string }
export type Field = { key:string; label:string; options?:Option[]; optional?:boolean; number?:boolean }
type Reply = { message:string; draft?:Draft }

export const labels:Record<Action,string> = {
  party:'Customers & suppliers · Add trading partner', item:'Catalogue · Add item', editItem:'Catalogue · Update item',
  purchase:'Purchasing · Create purchase order', receipt:'Purchasing · Receive approved order',
  sale:'Sales & POS · Post invoice', payment:'Payments · Allocate payment', return:'Returns · Post sales return',
}
const draftModules:Record<Action,Module> = {
  party:'Customers & suppliers', item:'Catalogue', editItem:'Catalogue', purchase:'Purchasing',
  receipt:'Purchasing', sale:'Sales & POS', payment:'Payments', return:'Returns',
}
export const mayDraft=(can:Grant,action:Action)=>can('AI Assistant')&&can(draftModules[action],action==='editItem'?'edit':'create')
const denied={message:'Your demo user does not have access to that module or action.'}
const choices = (...names:string[]) => names.map(name=>({id:name,name}))
const methods = choices('Cash','Bank transfer','Card (simulated)','Digital wallet (simulated)')
const field = (key:string,label:string,options?:Option[]):Field => ({key,label,options})
const numeric = (key:string,label:string):Field => ({key,label,number:true})
const unpaid = (data:Data) => data.docs.filter(d=>(d.kind==='Sale'||(d.kind==='Purchase'&&d.status==='Received'))&&balance(data,d)>0)
const receivableOrders = (data:Data) => data.docs.filter(d=>d.kind==='Purchase'&&['Approved','Part received'].includes(d.status))
const docOptions = (data:Data, docs:Data['docs']) => docs.map(d=>({id:d.id,name:d.id+' · '+(data.parties.find(p=>p.id===d.party)?.name??'')+' · '+(locations.find(l=>l.id===d.location)?.name??'')}))
export function fields(data:Data, action:Action, v:Values):Field[] {
  const item = field('item','Item',data.products.map(p=>({id:p.id,name:p.name+' · '+p.sku+' ('+p.unit+')'})))
  const location = field('location','Warehouse',locations)
  const document = data.docs.find(d=>d.id===v.document)
  const quantity = numeric('qty','Quantity in catalogue units')
  switch(action) {
    case 'party': return [field('name','Trading partner name'),field('type','Trading partner type',choices('Customer','Supplier')),field('city','City'),{...field('contact','Fictional reference'),optional:true}]
    case 'editItem': return [item,{...numeric('price','New selling price (PKR)'),optional:true},{...numeric('reorder','New reorder level'),optional:true}]
    case 'item': return [field('name','Item name'),field('sku','SKU'),field('category','Category'),field('unit','Unit'),numeric('price','Selling price (PKR)'),numeric('reorder','Reorder level')]
    case 'purchase':
    case 'sale': return [field('party',action==='sale'?'Customer':'Supplier',data.parties.filter(p=>p.type===(action==='sale'?'Customer':'Supplier'))),location,item,quantity,numeric('price','Unit price (PKR)'),...(action==='sale'?[field('settlement','Settlement',choices('Pay now','Credit sale')),...(v.settlement==='Pay now'?[field('method','Payment method',methods)]:[])]:[])]
    case 'receipt': return [field('document','Approved purchase order',docOptions(data,receivableOrders(data))),field('item','Order item',data.products.filter(p=>document?.lines.some((l,i)=>l.item===p.id&&document.received[i]<l.qty))),quantity]
    case 'payment': return [field('document','Open invoice or payable',docOptions(data,unpaid(data))),numeric('amount','Payment amount (PKR)'),field('method','Payment method',methods)]
    case 'return': return [field('document','Original sales invoice',docOptions(data,data.docs.filter(d=>d.kind==='Sale'))),field('item','Eligible invoice item',data.products.filter(p=>document&&returnable(data,document,p.id)>0)),quantity,field('disposition','Stock disposition',choices('Restock as sellable','Scrap')),field('settlement','Financial settlement',choices('Credit note','Refund'))]
  }
}
export function unresolved(data:Data,draft:Draft) {
  return fields(data,draft.action,draft.values).filter(f=> (!f.optional&&!draft.values[f.key]?.trim()) || (f.options&&!f.options.some(o=>o.id===draft.values[f.key])))
}
export function applyDraft(data:Data,draft:Draft):string {
  const missing=unresolved(data,draft)
  if(missing.length) throw Error('Complete '+missing.map(f=>f.label).join(', ')+'.')
  const v=draft.values
  const n=(key:string,min:number,whole=false)=>{
    const val=Number(v[key])
    if(!Number.isFinite(val)||val<min||(whole&&!Number.isInteger(val))) throw Error('Check '+fields(data,draft.action,v).find(f=>f.key===key)?.label+'.')
    return val
  }
  switch(draft.action) {
    case 'party':
      if(data.parties.some(p=>p.type===v.type&&p.name.toLowerCase()===v.name.trim().toLowerCase())) throw Error('A matching trading partner already exists.')
      data.parties.push({id:crypto.randomUUID(),name:v.name.trim(),type:v.type==='Supplier'?'Supplier':'Customer',city:v.city.trim(),phone:v.contact??''})
      return v.type+' added · '+v.name
    case 'editItem': {
      const item=data.products.find(p=>p.id===v.item)!
      if(!v.price?.trim()&&!v.reorder?.trim())throw Error('Enter a new price or reorder level.')
      updateProduct(data,item.id,{...item,price:v.price?.trim()?n('price',0):item.price,reorder:v.reorder?.trim()?n('reorder',0,true):item.reorder})
      return 'Catalogue item updated · '+item.name
    }
    case 'item':
      if(data.products.some(p=>p.sku===v.sku.trim().toUpperCase())) throw Error('A matching SKU already exists.')
      data.products.push({id:crypto.randomUUID(),name:v.name.trim(),sku:v.sku.trim().toUpperCase(),category:v.category.trim(),unit:v.unit.trim(),price:n('price',0),reorder:n('reorder',0,true)})
      return 'Item added · '+v.name
    case 'sale':
    case 'purchase':
      return createDocument(data,draft.action==='sale'?'Sale':'Purchase',v.party,v.location,[{item:v.item,qty:n('qty',1,true),price:n('price',0)}],v.settlement==='Pay now',v.method??'')+' created'
    case 'receipt': {
      const doc=data.docs.find(d=>d.id===v.document)!
      receive(data,doc.id,doc.lines.map(l=>l.item===v.item?n('qty',1,true):0))
      return doc.id+' receipt posted · inventory updated'
    }
    case 'payment':
      recordPayment(data,v.document,n('amount',.01),v.method)
      return 'Payment allocated · '+v.document
    case 'return':
      recordReturn(data,v.document,v.item,n('qty',1,true),v.disposition,v.settlement)
      return 'Return posted · '+v.document
  }
}

const clean = (s:string) => s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const contains = (text:string, phrase:string) => !!clean(phrase)&&(' '+clean(text)+' ').includes(' '+clean(phrase)+' ')
function match<T extends Option>(text:string,options:T[],aliases:(o:T)=>string[] = o=>[o.name]) {
  const full = options.filter(o=>aliases(o).some(a=>contains(text,a)))
  if(full.length) return full
  const words = new Set(['store','shop','traders','mart','supply','co','main','pack','bottle','carton','bag'])
  return options.filter(o=>clean(o.name).split(' ').some(w=>w.length>=4&&!words.has(w)&&contains(text,w)))
}
function read(data:Data,text:string,parties:Data['parties'],can:Grant):Reply|undefined {
  if (/low.stock|kam stock|stock kam|reorder/i.test(text)) {
    if(!can('Inventory'))return denied
    const items=data.products.flatMap(p=>locations.flatMap(l=>{const {qty}=stock(data,p.id,l.id);return qty<=p.reorder?[p.name+' · '+l.name+' · '+qty+' '+p.unit]:[]}))
    return {message:items.length?'Low-stock balances as of '+day(new Date().toISOString())+'\n'+items.join('\n'):'No item-location balances are at reorder level.'}
  }
  if(/balance|outstanding|statement|baqaya|baki|bakaya/i.test(text)) {
    if(!can('Customers & suppliers')&&!can('Reports'))return denied
    const type = /supplier|vendor|payable/i.test(text)?'Supplier':'Customer'
    if(parties.length>1) return {message:'Which trading partner? Possible matches: '+parties.map(p=>p.name).join(', ')+'.'}
    const selected=parties.length?parties:data.parties.filter(p=>p.type===type)
    const lines=selected.map(p=>p.name+' · '+money(partyBalance(data,p.id)))
    if(parties.length===1&&/statement/i.test(text)) {
      const party=parties[0]
      lines.push(...data.docs.filter(d=>d.party===party.id&&(d.kind==='Sale'||(d.kind==='Purchase'&&d.status==='Received'))).map(d=>d.id+' · '+day(d.date)+' · '+money(balance(data,d))+' open'))
      lines.push(...data.payments.filter(p=>p.party===party.id).map(p=>p.id+' · '+p.kind+' · '+money(p.amount)+' · '+p.document))
    }
    return {message:'Operational balances\n'+lines.join('\n')}
  }
  if(/\b(stock|inventory|on hand|available|quantity|kitna|kitni|kitne)\b/i.test(text)&&!/report|valuation/i.test(text)) {
    if(!can('Inventory'))return denied
    const items=match(text,data.products,p=>[p.name,p.sku])
    if(items.length>1)return {message:'Which item? Possible matches: '+items.map(p=>p.name).join(', ')+'.'}
    if(!items.length)return {message:'Which item should I check? Include its catalogue name or SKU.'}
    const warehouses=match(text,locations,l=>[l.name,l.branch,l.id])
    if(warehouses.length>1)return {message:'Which warehouse should I check? '+warehouses.map(l=>l.name).join(', ')+'.'}
    if(!warehouses.length&&/\bwarehouse\b/i.test(text))return {message:'Which warehouse should I check? Use Karachi or Lahore.'}
    const item=items[0]
    return {message:item.name+'\n'+(warehouses.length?warehouses:locations).map(l=>l.name+' · '+stock(data,item.id,l.id).qty+' '+item.unit).join('\n')}
  }
  if(/report|valuation/i.test(text)) {
    if(!can('Reports'))return denied
    const sales=data.docs.filter(d=>d.kind==='Sale').reduce((n,d)=>n+d.subtotal,0)
    const credits=data.docs.filter(d=>d.kind==='Return').reduce((n,d)=>n+d.subtotal,0)
    return {message:['Operational report · demo figures','Net sales before tax · '+money(sales-credits),...locations.map(l=>l.name+' stock value · '+money(data.products.reduce((n,p)=>n+stock(data,p.id,l.id).value,0)))].join('\n')}
  }
}


export interface AssistantService { understand(text:string,data:Data,can?:Grant):Reply }
export const localAssistant:AssistantService = {
  understand(text,data,can=()=>true) {
    const q=clean(text), v:Values={}
    let action:Action|undefined
    const payment=/\b(pay|paid|payment|collection|jama|ada)\b/.test(q)
    const sale=/\b(sell|sold|sale|bech|becha|beche|bechi)\b/.test(q)
    const receipt=/\b(receive|received|receipt|mila|mile|milay|pohanchay)\b/.test(q)
    const add=/\b(add|create|new|banao|bana|karo|karein|register)\b/.test(q)
    if(/\b(transfer|adjustment|adjust|count|supplier bill|vendor bill|purchase return|delete|void|email|whatsapp|fbr)\b/.test(q)) {
      return {message:'This request has no matching assistant workflow. Standalone supplier bills, transfers, counts, adjustments, purchase returns and edits to posted records are outside the current demo services. A fully received purchase order creates the demo payable.'}
    }
    const edit=/\b(edit|update|change|badlo|tabdeel|set)\b/.test(q)
    const catalogueEdit=edit&&/\b(item|product|sku|price|rate|reorder|qeemat)\b/.test(q)
    if(edit&&!catalogueEdit)return {message:'I can update an item’s selling price or reorder level. Edits to other records are unavailable in this chat.'}
    if(catalogueEdit) action='editItem'
    else if(/\b(return|refund|wapas)\b/.test(q)) action='return'
    else if(payment&&!sale) action='payment'
    else if(receipt) action='receipt'
    else if(sale) action='sale'
    else if(/\b(purchase order|po|purchase|khareed|kharid)\b/.test(q)&&add) action='purchase'
    else if(add&&/\b(supplier|vendor|customer|company|party|client)\b/.test(q)) action='party'
    else if(add&&/\b(item|product|catalogue|sku)\b/.test(q)) action='item'

    const partyType = action==='sale'?'Customer':action==='receipt'||action==='purchase'?'Supplier':undefined
    const parties=match(text,data.parties.filter(p=>!partyType||p.type===partyType))
    if(!action) return read(data,text,parties,can)??{message:'Which action should I prepare? Try adding a supplier, receiving against an approved PO, posting a sale or return, recording a payment, or asking for low stock.'}
    const readIntent=/^(show|list|view|what|check|dikhao|batao)\b/.test(q)||/\b(dikhao|batao)\b/.test(q)
    if(readIntent) {
      if(action==='sale'&&/\b(report|summary|sales)\b/.test(q)) return read(data,'report',parties,can)!
      const answer=read(data,text,parties,can)
      if(answer) return answer
      return {message:'Try asking for a report, low stock, or a party statement. Read-only requests do not post transactions.'}
    }

    if(!mayDraft(can,action))return denied
    if(action==='editItem') {
      const items=match(text,data.products,p=>[p.name,p.sku])
      if(items.length>1)return {message:'Which item? Possible matches: '+items.map(p=>p.name+' ('+p.sku+')').join(', ')+'.'}
      if(items.length===1)v.item=items[0].id
      const price=text.match(/\b(?:price|rate|qeemat)\s*(?:(?:to|se|ko|at)\s*)?(?:(?:rs\.?|pkr)\s*)?([\d,]+(?:\.\d+)?)/i)
        ??text.match(/\b(?:rs\.?|pkr)\s*([\d,]+(?:\.\d+)?)/i)
      if(price)v.price=price[1].replace(/,/g,'')
      const reorder=text.match(/\breorder(?: level)?\s*(?:to\s*)?(\d+)/i)
      if(reorder)v.reorder=reorder[1]
      if(/\b(rename|name|category|unit)\b/i.test(text)&&!v.reorder)return {message:'Chat supports price and reorder updates. Use Catalogue → Edit for item names, categories or units.'}
    }
    if(action==='party') {
      const supplier=/\b(supplier|vendor)\b/.test(q),customer=/\b(customer|client)\b/.test(q)
      if(supplier===customer) return {message:'Should this company be a customer or a supplier? Include its name and city if known.'}
      v.type=supplier?'Supplier':'Customer'
      const name=text.match(/^(?:add|create|register)\s+(.+?)\s+(?:as\s+(?:an?\s+)?(?:supplier|vendor|customer|client)|ko\s+(?:supplier|customer))/i)?.[1]
        ??text.match(/^(?:add|create|new)\s+(?:supplier|vendor|customer|client)\s+(.+?)(?=\s+(?:in|from|city)\b|[,.!?]|$)/i)?.[1]
        ??text.match(/^(.+?)\s+ko\s+(?:supplier|vendor|customer|client)\b/i)?.[1]
      const namedReply=text.match(/^(?:add|create)\s+this\s+company\s+(?:as\s+)?(?:supplier|customer)\s+(.+?)(?=\s+(?:in|from|city)\b|[,.!?]|$)/i)?.[1]
      if(namedReply)v.name=namedReply.trim()
      if(name&&!/^(this|a|the)\s+(company|party)$/i.test(name))v.name=name.trim()
      v.city=text.match(/\b(?:in|from|city)\s+([a-z][a-z -]*?)(?=[,.!?]|\s+(?:as|mein)\b|$)/i)?.[1]?.trim()??''
    }
    if(action==='item') {
      v.name=(text.match(/(?:add|create|new)\s+(?:item|product)\s+(.+?)(?=\s+(?:sku|price|category|unit|reorder)\b|[,.!?]|$)/i)?.[1]
        ??text.match(/^(.+?)\s+ko\s+(?:item|product)\b/i)?.[1])?.trim()??''
      v.sku=text.match(/\bsku\s+([a-z0-9-]+)/i)?.[1]??''
      v.price=text.match(/\b(?:price|rate|qeemat)\s*(?:(?:rs\.?|pkr)\s*)?([\d,]+(?:\.\d+)?)/i)?.[1]?.replace(/,/g,'')??''
      v.reorder=text.match(/\breorder(?: level)?\s+(\d+)\b/i)?.[1]??''
      v.category=text.match(/\bcategory\s+(.+?)(?=\s+(?:sku|price|unit|reorder)\b|[,.;!?]|$)/i)?.[1]?.trim()??''
      v.unit=text.match(/\bunit\s+([a-z]+)\b/i)?.[1]??''
    }
    if(action!=='party'&&action!=='item'&&action!=='editItem') {
      const items=match(text,data.products,p=>[p.name,p.sku])
      if(items.length>1)return {message:'Which item? Possible matches: '+items.map(p=>p.name+' ('+p.sku+')').join(', ')+'.'}
      if(parties.length>1)return {message:'Which trading partner? Possible matches: '+parties.map(p=>p.name).join(', ')+'.'}
      if(parties.length===1)v.party=parties[0].id
      const item=items[0]
      if(item)v.item=item.id
      const warehouses=match(text,locations,l=>[l.name,l.branch,l.id])
      if(warehouses.length>1)return {message:'Which warehouse? Possible matches: '+warehouses.map(l=>l.name).join(', ')+'.'}
      if(warehouses.length===1)v.location=warehouses[0].id
      const qty=text.match(/\b(\d+)\s*(cartons?|cases?|boxes?|bags?|packs?|bottles?|units?|pieces?|pcs|dabbe|peti)\b/i)
      if(qty) {
        const unit=qty[2].toLowerCase().replace(/s$/,'')
        if(!item||unit===item.unit.toLowerCase()||['unit','piece','pc'].includes(unit))v.qty=qty[1]
      } else if(item&&action!=='payment') {
        const nameAt=text.toLowerCase().indexOf(item.name.toLowerCase())
        v.qty=nameAt>0?text.slice(0,nameAt).match(/(\d+)\s*$/)?.[1]??'':''
      }
      const amount=text.match(/\b(?:rs\.?|pkr)\s*([\d,]+(?:\.\d+)?)/i)?.[1]?.replace(/,/g,'')
      if(action==='payment'&&amount)v.amount=amount
      if((action==='purchase'||action==='sale')&&amount&&/\b(?:at|price|each|per|rate)\b/.test(q))v.price=amount
      if(action==='sale'&&item&&!v.price&&!amount)v.price=String(item.price)
      if(/\bcash\b/.test(q))v.method='Cash'
      else if(/\bbank(?: transfer)?\b/.test(q))v.method='Bank transfer'
      else if(/\bcard\b/.test(q))v.method='Card (simulated)'
      else if(/\bwallet\b/.test(q))v.method='Digital wallet (simulated)'
      if(action==='sale') {
        if(/\b(credit|udhar|on account)\b/.test(q))v.settlement='Credit sale'
        else if(v.method)v.settlement='Pay now'
      }
      if(action==='return') {
        if(/\b(restock|sellable)\b/.test(q))v.disposition='Restock as sellable'
        if(/\b(scrap|discard)\b/.test(q))v.disposition='Scrap'
        if(/\brefund\b/.test(q))v.settlement='Refund'
        if(/\bcredit\b/.test(q))v.settlement='Credit note'
      }
      if(['receipt','return','payment'].includes(action)) {
        const ref=text.match(/\b(invoice|inv|po|purchase order)\s*[-#]?\s*(\d+)\b/i)
        const source=action==='receipt'?receivableOrders(data):action==='return'?data.docs.filter(d=>d.kind==='Sale'):unpaid(data)
        const candidates=source.filter(d=>(!v.party||d.party===v.party)&&(!v.location||d.location===v.location)&&(!v.item||d.lines.some(l=>l.item===v.item)))
        if(ref) {
          const prefix=/invoice|inv/i.test(ref[1])?'INV':'PO'
          const id=prefix+'-'+ref[2].padStart(4,'0')
          if(!candidates.some(d=>d.id===id))return {message:id+' is unavailable for this action or does not match the requested records. Receipts require an approved purchase order. Payments require an open balance.'}
          v.document=id
        } else if(action==='receipt'&&v.party&&v.item&&v.location&&candidates.length===1)v.document=candidates[0].id
        else if(candidates.length>1&&(v.party||v.item))return {message:'Which document should I use? Possible matches: '+candidates.map(d=>d.id).join(', ')+'. Include the reference in your reply.'}
        if(action==='receipt'&&source.length===0)return {message:'There is no approved purchase order ready to receive. Create an order and approve it in Purchasing, then request the receipt. Creating the order does not add stock.'}
      }
    }
    if(/\b(yesterday|tomorrow|kal|parson)\b|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(text)) {
      return {message:'The demo records transactions at approval time. Backdating and future dating are unavailable. Send the request without that date to prepare a current transaction.'}
    }
    if(action==='receipt'&&v.document&&!v.item&& !/\b(cartons?|boxes?|packs?|bottles?|bags?)\b/i.test(text)) {
      const order=data.docs.find(d=>d.id===v.document)!
      const remaining=order.lines.filter((l,i)=>l.qty>order.received[i])
      if(remaining.length===1&&/\bunits?\b/i.test(text))v.item=remaining[0].item
    }
    const draft:Draft={id:crypto.randomUUID(),text,action,values:v,status:'Pending'}
    const missing=unresolved(data,draft)
    if(action==='editItem'&&!v.price&&!v.reorder)return {draft,message:'What should the new selling price or reorder level be? Enter it on the draft below.'}
    return {draft,message:missing.length?'Please confirm '+missing.map(f=>f.label.toLowerCase()).join(', ')+'. You can fill them in on the draft below.':'Review the matched records and values below. Approve & Add applies the draft.'}
  },
}


