import { useEffect, useState, type ReactNode } from 'react'
import { Layers3, LayoutDashboard, Package, Users, Truck, ShoppingCart, Warehouse, RotateCcw, Wallet, ChartNoAxesCombined, FileText, Settings, Search, Bell, ChevronRight, Plus, ArrowRight, Boxes, ArrowDownLeft, ArrowUpRight, Building2, TriangleAlert, Menu, Bot, LogOut, X } from 'lucide-react'
import { approve, balance, browserRepository, day, documentStatus, locations, money, now, partyBalance, stock, type Data, type Document } from './demo'
import { Workflow, type Dialog } from './Workflow'
import { Assistant } from './Assistant'
import { currentUser, logout, allows, managesUsers, type User, type Grant } from './access'
import { Login, UserManagement } from './AccountScreens'
import { resetAssistant } from './assistantService'
import { Table, Panel, Badge, warehouse, partyName, itemName } from './ui'

const repo = browserRepository(localStorage)
const nav = [
  ['Dashboard', LayoutDashboard, 'Here’s what’s happening across your business today.'],
  ['Catalogue', Package, 'Manage your items, selling prices and reorder levels.'],
  ['Customers & suppliers', Users, 'Track trading partners and reconcile their operational balances.'],
  ['Purchasing', Truck, 'Create, approve and receive purchase orders.'],
  ['Sales & POS', ShoppingCart, 'Post counter sales and credit invoices.'],
  ['Inventory', Warehouse, 'Review stock balances, valuation and movements.'],
  ['Returns', RotateCcw, 'Record stock disposition and customer credit or refund.'],
  ['Payments', Wallet, 'Record collections and supplier payments.'],
  ['Reports', ChartNoAxesCombined, 'Review sales, stock valuation and party balances.'],
  ['Documents', FileText, 'Preview and print your commercial documents.'],
  ['Administration', Settings, 'Manage local demo settings and warehouse details.'],
  ['AI Assistant', Bot, 'Ask about demo records and prepare changes for review.'],
] as const
type Page = typeof nav[number][0]
const pageFromHash = () => nav.find(([p]) => encodeURIComponent(p) === location.hash.slice(1))?.[0] ?? 'Dashboard'
const dateKey = (date: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date))
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()

function SalesChart({sales, period}: {sales: Document[]; period: number}) {
  const ends = Array.from({length:7}, (_,i) => daysAgo(period - Math.ceil((i+1)*period/7)))
  const values = ends.map((end,i) => sales.filter(d => dateKey(d.date) <= dateKey(end) && (!i || dateKey(d.date) > dateKey(ends[i-1]))).reduce((n,d)=>n+d.total,0))
  const max = Math.max(20000, Math.ceil(Math.max(...values)/20000)*20000)
  const points = values.map((v,i) => [54+i*88, 165-v/max*137])
  const path = points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ')
  const labels = ends.map(d => day(d).split(' ').slice(0,2).join(' '))
  return <div className="chart"><svg viewBox="0 0 610 195" role="img" aria-label={labels.map((l,i)=>l+' '+money(values[i])).join(', ')}>
    <defs><linearGradient id="area" x2="0" y2="1"><stop stopColor="#3163ff" stopOpacity=".23"/><stop offset="1" stopColor="#3163ff" stopOpacity=".01"/></linearGradient></defs>
    {[0,1,2,3,4].map(i=><g key={i}><line x1="52" x2="598" y1={28+i*34.25} y2={28+i*34.25} stroke="#e4eaf4" strokeDasharray="4 4"/><text x="9" y={32+i*34.25}>{i===4?'0':max*(4-i)/4000+'k'}</text></g>)}
    <path d={path+' L582 165 L54 165 Z'} fill="url(#area)"/><path d={path} fill="none" stroke="#315df4" strokeWidth="3" strokeLinejoin="round"/>
    {points.map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="4" fill="white" stroke="#315df4" strokeWidth="2"><title>{labels[i]} · {money(values[i])}</title></circle><text x={x} y="187" textAnchor="middle">{labels[i]}</text></g>)}
  </svg><div className="legend"><i/> Invoice value</div></div>
}

export function App() {
  const [user,setUser]=useState(currentUser)
  if(!user)return <Login onLogin={setUser}/>
  return <Workspace key={user.id} user={user} signOut={()=>{logout();setUser(undefined)}}/>
}

function Workspace({user,signOut}:{user:User;signOut:()=>void}) {
  const can:Grant=(module,action)=>allows(user,module,action)
  const available=nav.filter(([module])=>can(module))
  const [chatOpen,setChatOpen]=useState(false)
  const [assistantVersion,setAssistantVersion]=useState(0)
  const [data,setData] = useState(repo.load)
  const [requestedPage,setPage] = useState<Page>(pageFromHash)
  const page=can(requestedPage)?requestedPage:available[0][0]
  const [dialog,setDialog] = useState<Dialog>()
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('All')
  const [movement,setMovement] = useState(false)
  const [period,setPeriod] = useState(7)
  const [report,setReport] = useState('Sales')
  const [menu,setMenu] = useState(false)
  const [notice,setNotice] = useState('')
  const [error,setError] = useState('')
  useEffect(()=>{
    const sync=()=>{setPage(pageFromHash());setQuery('');setFilter('All');setMenu(false);window.scrollTo(0,0)}
    window.addEventListener('hashchange',sync)
    return ()=>window.removeEventListener('hashchange',sync)
  },[])
  useEffect(()=>{
    const sync=()=>setData(repo.load())
    window.addEventListener('storage',sync)
    return ()=>window.removeEventListener('storage',sync)
  },[])
  useEffect(()=>{if(notice){const timer=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(timer)}},[notice])
  const go=(p:Page)=>{if(!can(p))return;location.hash=encodeURIComponent(p);setMenu(false)}
  const canOpen=(type:Dialog['type'],id?:string)=>{
    switch(type) {
      case 'item': return can('Catalogue',id?'edit':'create')
      case 'deleteItem': return can('Catalogue','delete')
      case 'party': return can('Customers & suppliers','create')
      case 'statement': return can('Customers & suppliers')||can('Reports')
      case 'purchase':
      case 'receive': return can('Purchasing','create')
      case 'sale': return can('Sales & POS','create')
      case 'payment': return can('Payments','create')
      case 'return': return can('Returns','create')
      case 'reset': return can('Administration','delete')
      case 'preview': {
        const doc=data.docs.find(d=>d.id===id)
        return !!doc&&(can('Documents')||can(doc.kind==='Sale'?'Sales & POS':doc.kind==='Purchase'?'Purchasing':'Returns'))
      }
      case 'guide': return can('Dashboard')
      case 'search': return true
    }
  }
  const open=(type:Dialog['type'],id?:string)=>{if(!canOpen(type,id))return;setError('');setDialog({type,id})}
  const change=(work:(d:Data)=>void,message:string,keep=false)=>{
    try {setData(repo.transact(work));setError('');if(!keep)setDialog(undefined);setNotice(message)}
    catch(e){setError(e instanceof Error?e.message:'Could not save demo data.')}
  }
  const match=(...parts:string[])=>parts.join(' ').toLowerCase().includes(query.trim().toLowerCase())
  const link=(id:string)=>canOpen('preview',id)?<button className="link" onClick={()=>open('preview',id)}>{id}</button>:id
  const sales=data.docs.filter(d=>d.kind==='Sale')
  const purchases=data.docs.filter(d=>d.kind==='Purchase')
  const returns=data.docs.filter(d=>d.kind==='Return')
  const position=data.products.flatMap(p=>locations.map(l=>({p,l,...stock(data,p.id,l.id)})))
  const lows=position.filter(s=>s.qty<=s.p.reorder)
  const stockValue=position.reduce((n,s)=>n+s.value,0)
  const due=(type:'Customer'|'Supplier')=>data.parties.filter(p=>p.type===type).reduce((n,p)=>n+partyBalance(data,p.id),0)
  const recent=sales.filter(d=>dateKey(d.date)>=dateKey(daysAgo(period-1)))
  const toolbar=(label:string,options:string[])=><div className="toolbar"><label className="search"><Search size={16}/><input aria-label={label} placeholder={label} value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter records" value={filter} onChange={e=>setFilter(e.target.value)}>{['All',...options].map(o=><option key={o}>{o}</option>)}</select></div>
  const action=(label:string,type:Dialog['type'])=>canOpen(type)?<button className="primary" onClick={()=>open(type)}><Plus size={17}/>{label}</button>:null
  const actions:Partial<Record<Page,ReactNode>>={Dashboard:action('New sale','sale'),Catalogue:action('Add item','item'),'Customers & suppliers':action('Add contact','party'),Purchasing:action('New purchase order','purchase'),'Sales & POS':action('New sale','sale'),Returns:action('New return','return'),Payments:action('Record payment','payment')}
  const docTable=(docs:Document[],buttons=false)=><Table headers={['Document','Type','Trading partner','Date','Status','Total',...(buttons?['Actions']:[])]} rows={docs.map(d=>[link(d.id),d.kind==='Purchase'?'Purchase order':d.kind==='Sale'?'Sales invoice':'Credit note',partyName(data,d.party),day(d.date),<Badge label={documentStatus(data,d)}/>,<strong>{money(d.total)}</strong>,...(buttons?[<div className="row-actions">
    {can('Purchasing','approve')&&d.kind==='Purchase'&&d.status==='Awaiting approval'&&<button onClick={()=>change(x=>approve(x,d.id),'Purchase order approved.')}>Approve</button>}
    {can('Purchasing','create')&&d.kind==='Purchase'&&['Approved','Part received'].includes(d.status)&&<button onClick={()=>open('receive',d.id)}>Receive</button>}
    {can('Payments','create')&&(d.kind==='Sale'||(d.kind==='Purchase'&&d.status==='Received'))&&balance(data,d)>0&&<button onClick={()=>open('payment',d.id)}>Settle</button>}
    {canOpen('preview',d.id)&&<button onClick={()=>open('preview',d.id)}>View</button>}
  </div>]:[])])}/>
  const docs=(list:Document[])=>list.filter(d=>match(d.id,partyName(data,d.party),warehouse(d.location),d.source??'')&&(filter==='All'||filter===d.kind||filter===d.status||filter===documentStatus(data,d)))
  const metrics=(all=false)=><div className="metrics">{[
    {label:all?'Net sales before tax':'Sales revenue',value:all?sales.reduce((n,d)=>n+d.subtotal,0)-returns.reduce((n,d)=>n+d.subtotal,0):recent.reduce((n,d)=>n+d.total,0),note:all?'After sales returns':'Last '+period+' days · posted invoices',Icon:ChartNoAxesCombined,color:'blue'},
    {label:'Stock valuation',value:stockValue,note:'Across 2 warehouses',Icon:Boxes,color:'purple'},
    {label:'Receivables',value:due('Customer'),note:'Net customer balance',Icon:ArrowDownLeft,color:'green'},
    {label:'Payables',value:due('Supplier'),note:'Outstanding supplier balance',Icon:ArrowUpRight,color:'amber'},
  ].map(({label,value,note,Icon,color})=><section className="metric" key={label}><div><span>{label}</span><span className={'tile '+color}><Icon size={18}/></span></div><strong>{money(value)}</strong><small>{note}</small></section>)}</div>

  return <div className="app">
    {menu&&<button className="mobile-overlay" aria-label="Close menu" onClick={()=>setMenu(false)}/>}
    <aside className={'sidebar '+(menu?'shown':'')}>
      <a href={"#"+encodeURIComponent(available[0][0])} className="brand"><span className="brand-mark"><Layers3 size={23}/></span><div>Blueledger<small>INVENTORY & BILLING</small></div></a>
      <div className="business"><span><Building2 size={17}/></span><div><strong>Meridian Supply Co.</strong><small>Demo workspace</small></div></div>
      <nav aria-label="Workspace">{nav.map(([p,Icon],i)=>can(p)&&<div key={p}>{[0,1,8].includes(i)&&<small className="nav-heading">{i===0?'WORKSPACE':i===1?'OPERATIONS':'MANAGE'}</small>}<a href={'#'+encodeURIComponent(p)} onClick={()=>setMenu(false)} aria-current={p===page?'page':undefined}><Icon size={17}/>{p}</a></div>)}</nav>
      {canOpen("guide")&&<button className="guide" onClick={()=>open('guide')}>Demo walkthrough <ArrowRight size={15}/></button>}
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button className="icon mobile-menu" aria-label="Toggle navigation" onClick={()=>setMenu(!menu)}><Menu size={21}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{page}</strong></div>
      <div className="top-actions"><button className="top-search" onClick={()=>open('search')} aria-label="Search workspace"><Search size={16}/><span>Search workspace</span></button>{can("Inventory")&&<button className="icon bell" aria-label="View inventory alerts" onClick={()=>{setMovement(false);go('Inventory')}}><Bell size={19}/>{lows.length>0&&<i/>}</button>}<span className="divider"/><div className="identity"><span className="avatar">{user.name.split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()}</span><div><strong>{user.name}</strong><span className="account-role">{user.role}</span></div><button className="secondary" onClick={signOut}><LogOut size={15}/> Logout</button></div></div></header>
      <main>
        <div className="page-head"><div>{page==='Dashboard'&&<small className="eyebrow"><i/> BUSINESS OVERVIEW</small>}<h1>{page}</h1><p>{nav.find(([p])=>p===page)?.[2]}</p></div><div className="head-actions">{page==='Dashboard'&&canOpen('purchase')&&<button className="secondary" onClick={()=>open('purchase')}><Plus size={16}/> Purchase order</button>}{actions[page]}</div></div>
        {error&&!dialog&&<p className="error" role="alert">{error}</p>}
        {page==='Dashboard'&&<>
          <div className="context"><span><i/> Demo data</span><span>{day(now())} · Asia/Karachi</span></div>
          {metrics()}
          <div className="dashboard-grid">
            <Panel title="Sales activity" note="Posted invoice value in PKR" action={<select aria-label="Sales period" value={period} onChange={e=>setPeriod(Number(e.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>}><SalesChart sales={recent} period={period}/></Panel>
            <Panel title="Needs attention" note="Stock and transaction alerts" action={<span className="tile amber"><TriangleAlert size={17}/></span>}><div className="alerts">
              <button onClick={()=>{setMovement(false);go('Inventory')}}><span className="tile amber"><Package size={17}/></span><span><strong>Low stock</strong><small>{lows.length} item-location balances at reorder level</small></span><ChevronRight size={16}/></button>
              <button onClick={()=>go('Purchasing')}><span className="tile blue"><Truck size={17}/></span><span><strong>Open purchase orders</strong><small>{purchases.filter(d=>d.status!=='Received').length} waiting for approval or receiving</small></span><ChevronRight size={16}/></button>
              <button onClick={()=>go('Payments')}><span className="tile purple"><Wallet size={17}/></span><span><strong>Outstanding collections</strong><small>{sales.filter(d=>balance(data,d)>0).length} invoices with a balance due</small></span><ChevronRight size={16}/></button>
            </div></Panel>
          </div>
          <Panel title="Recent transactions" note="Latest purchases, sales and returns" action={<button className="secondary" onClick={()=>go('Documents')}>View documents <ArrowRight size={15}/></button>}>{docTable([...data.docs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5))}</Panel>
        </>}
        {page==='Catalogue'&&<Panel title="Items">{toolbar('Search items or SKUs',[...new Set(data.products.map(p=>p.category))])}<Table headers={['Item','SKU','Category','Unit','Selling price','Reorder level','Actions']} rows={data.products.filter(p=>match(p.name,p.sku,p.category)&&(filter==='All'||p.category===filter)).map(p=>[<strong>{p.name}</strong>,p.sku,p.category,p.unit,money(p.price),p.reorder,<div className="row-actions">{can("Catalogue","edit")&&<button aria-label={"Edit "+p.name} onClick={()=>open("item",p.id)}>Edit</button>}{can("Catalogue","delete")&&<button aria-label={"Delete "+p.name} onClick={()=>open("deleteItem",p.id)}>Delete</button>}</div>])}/></Panel>}
        {page==='Customers & suppliers'&&<Panel title="Trading partners">{toolbar('Search names or cities',['Customer','Supplier'])}<Table headers={['Name','Type','City','Reference','Net balance','Statement']} rows={data.parties.filter(p=>match(p.name,p.city,p.phone)&&(filter==='All'||p.type===filter)).map(p=>[<strong>{p.name}</strong>,p.type,p.city,p.phone,money(partyBalance(data,p.id)),<button className="link" onClick={()=>open('statement',p.id)}>View statement <ArrowRight size={14}/></button>])}/></Panel>}
        {page==='Purchasing'&&<Panel title="Purchase orders" note="A fully received purchase order creates the demo payable.">{toolbar('Search purchase orders',['Awaiting approval','Approved','Part received','Received','Part paid','Settled'])}{docTable(docs(purchases),true)}</Panel>}
        {page==='Sales & POS'&&<Panel title="Sales invoices">{toolbar('Search invoices',['Posted','Part paid','Settled','Customer credit'])}{docTable(docs(sales),true)}</Panel>}
        {page==='Inventory'&&<Panel title={movement?'Stock movement ledger':'Stock by warehouse'} note="Moving weighted-average demo valuation" action={<button className="secondary" onClick={()=>{setMovement(!movement);setFilter('All')}}>{movement?'View balances':'View movements'}</button>}>{toolbar('Search inventory',[...locations.map(l=>l.name),...(!movement?['Low stock']:[])])}
          {movement?<Table headers={['Movement','Date','Item','Warehouse','Quantity','Unit cost','Source']} rows={[...data.moves].reverse().filter(m=>match(itemName(data,m.item),m.document)&&(filter==='All'||warehouse(m.location)===filter)).map(m=>[m.id,day(m.date),itemName(data,m.item),warehouse(m.location),m.qty>0?'+'+m.qty:m.qty,money(m.cost),m.document==='Opening stock'?m.document:link(m.document)])}/>:<Table headers={['Item','SKU','Warehouse','On hand','Average cost','Stock value','Status']} rows={position.filter(s=>match(s.p.name,s.p.sku)&&(filter==='All'||s.l.name===filter||(filter==='Low stock'&&s.qty<=s.p.reorder))).map(s=>[<strong>{s.p.name}</strong>,s.p.sku,s.l.name,s.qty,money(s.average),money(s.value),<Badge label={!s.qty?'Out of stock':s.qty<=s.p.reorder?'Low stock':'In stock'}/>])}/>}
        </Panel>}
        {page==='Returns'&&<Panel title="Sales returns">{toolbar('Search returns',['Credited','Refunded'])}<Table headers={['Credit note','Invoice','Customer','Date','Disposition','Settlement','Amount']} rows={docs(returns).map(d=>[link(d.id),link(d.source!),partyName(data,d.party),day(d.date),d.disposition,<Badge label={d.status}/>,money(d.total)])}/></Panel>}
        {page==='Payments'&&<Panel title="Payment history">{toolbar('Search payments or references',['Collection','Supplier payment','Refund'])}<Table headers={['Payment','Source','Trading partner','Date','Method','Type','Amount']} rows={data.payments.filter(p=>match(p.id,p.document,partyName(data,p.party),p.method)&&(filter==='All'||p.kind===filter)).map(p=>[p.id,link(p.document),partyName(data,p.party),day(p.date),p.method,p.kind,money(p.amount)])}/></Panel>}
        {page==='Documents'&&<Panel title="Commercial documents" note="Open a record to preview or print its saved values.">{toolbar('Search documents',['Purchase','Sale','Return'])}{docTable(docs(data.docs))}</Panel>}
        {page==='Reports'&&<>{metrics(true)}<Panel title="Operational reports" action={<select aria-label="Report type" value={report} onChange={e=>setReport(e.target.value)}>{['Sales','Stock valuation','Party balances'].map(r=><option key={r}>{r}</option>)}</select>}>
          {report==='Sales'&&<Table headers={['Invoice','Customer','Date','Net sales','COGS','Gross margin']} rows={sales.map(d=>{const credits=returns.filter(r=>r.source===d.id);const net=d.subtotal-credits.reduce((n,r)=>n+r.subtotal,0);const cost=d.cost-credits.reduce((n,r)=>n+r.cost,0);return [link(d.id),partyName(data,d.party),day(d.date),money(net),money(cost),money(net-cost)]})}/>}
          {report==='Stock valuation'&&<Table headers={['Warehouse','Units','Valuation']} rows={locations.map(l=>{const records=position.filter(s=>s.l.id===l.id);return [l.name,records.reduce((n,s)=>n+s.qty,0),money(records.reduce((n,s)=>n+s.value,0))]})}/>}
          {report==='Party balances'&&<Table headers={['Party','Type','Net balance','Statement']} rows={data.parties.map(p=>[p.name,p.type,money(partyBalance(data,p.id)),<button className="link" onClick={()=>open('statement',p.id)}>View statement</button>])}/>}
        </Panel></>}
        {page==='Administration'&&<>
          <div className="dashboard-grid"><Panel title="Organisation" note="Fictional Pakistan-based business"><dl className="details"><dt>Business</dt><dd>Meridian Supply Co.</dd><dt>Currency</dt><dd>PKR</dd><dt>Time zone</dt><dd>Asia/Karachi</dd><dt>Interface</dt><dd>English</dd></dl></Panel>
          <Panel title="Demo tax" note="Illustrative example applied to new documents.">{can("Administration","edit")&&<form className="form admin" onSubmit={e=>{e.preventDefault();const tax=Number(new FormData(e.currentTarget).get('tax'));change(d=>{d.tax=tax},'Demo tax rate saved.')}}><label className="field"><span>Example tax rate (%)</span><input key={data.tax} name="tax" type="number" min="0" max="100" step=".01" defaultValue={data.tax} required/></label><button className="primary">Save demo tax</button></form>}</Panel></div>
          <Panel title="Branches and warehouses"><Table headers={['Warehouse','Branch','Type']} rows={locations.map(l=>[l.name,l.branch,l.type])}/></Panel>
          <Panel title="Reset Demo Data" note="Restore the fictional seed records in this browser." action={canOpen("reset")&&<button className="danger" onClick={()=>open('reset')}><RotateCcw size={16}/> Reset Demo Data</button>}><p className="admin">Sign-in, approvals and FBR submission states are local simulations.</p></Panel>
        </>}
        {page==='Administration'&&managesUsers(user)&&<UserManagement user={user}/>}
        {can('AI Assistant')&&<section id="workspace-assistant"
          className={chatOpen?'assistant-mounted assistant-float':'assistant-mounted'}
          hidden={page!=='AI Assistant'&&!chatOpen} aria-label="AI Assistant">
          {chatOpen&&<button className="icon assistant-close" aria-label="Close AI chat" onClick={()=>setChatOpen(false)}><X size={20}/></button>}
          <Assistant key={assistantVersion} data={data} can={can} userId={user.id} commit={work=>{
            let result=''
            setData(repo.transact(d=>{result=work(d)}))
            return result
          }}/>
        </section>}
        <footer>Blueledger <span>·</span> Interactive demo <span>·</span> Fictional data</footer>
      </main>
    </div>
    {can('AI Assistant')&&<button className="primary assistant-launch" aria-label="Toggle AI chat" aria-controls="workspace-assistant"
      aria-expanded={chatOpen} onClick={()=>setChatOpen(open=>!open)}>
      <Bot size={20}/> AI Assistant
    </button>}
    {notice&&<div className="toast" role="status"><span>✓</span>{notice}</div>}
    {dialog&&canOpen(dialog.type,dialog.id)&&<Workflow key={dialog.type+dialog.id} dialog={dialog} data={data} error={error} close={()=>{setDialog(undefined);setError('')}} change={change} open={open} canEditDocuments={can("Documents","edit")} searchableDocs={data.docs.filter(d=>canOpen("preview",d.id))} pages={available.map(([p])=>p)} navigate={p=>{const found=nav.find(([label])=>label===p);if(found)go(found[0])}} reset={()=>{try{setData(repo.reset());resetAssistant();setAssistantVersion(v=>v+1);setDialog(undefined);setNotice('Demo data restored.')}catch{setError('Could not restore local data.')}}}/>}
  </div>
}


