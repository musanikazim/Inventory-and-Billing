export type Product = { id: string; name: string; sku: string; category: string; unit: string; price: number; reorder: number }
export type Party = { id: string; name: string; type: 'Customer' | 'Supplier'; city: string; phone: string }
export type Line = { item: string; qty: number; price: number }
export type Document = { id: string; kind: 'Purchase' | 'Sale' | 'Return'; date: string; party: string; location: string; lines: Line[]; subtotal: number; tax: number; total: number; cost: number; status: string; received: number[]; source?: string; disposition?: string; submission?: string }
export type Payment = { id: string; date: string; document: string; party: string; amount: number; method: string; kind: 'Collection' | 'Supplier payment' | 'Refund' }
export type Movement = { id: string; document: string; date: string; item: string; location: string; qty: number; cost: number }
export type Data = { products: Product[]; parties: Party[]; docs: Document[]; payments: Payment[]; moves: Movement[]; tax: number; role: string }
export const locations = [
  { id: 'KHI', name: 'Karachi Main', branch: 'Karachi', type: 'Main warehouse' },
  { id: 'LHR', name: 'Lahore Distribution', branch: 'Lahore', type: 'Distribution warehouse' },
]
export const money = (n: number) => 'Rs. ' + new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(n)
export const day = (date: string) => new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
export const now = () => new Date().toISOString()
const past = (days: number) => new Date(Date.now() - days * 86400000).toISOString()
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const id = (prefix: string, count: number) => prefix + '-' + String(count + 1).padStart(4, '0')
export const totalLines = (lines: Line[]) => round(lines.reduce((sum, line) => sum + line.qty * line.price, 0))
export function stock(data: Data, item: string, location: string) {
  const moves = data.moves.filter(m => m.item === item && m.location === location)
  const qty = moves.reduce((sum, m) => sum + m.qty, 0)
  const value = moves.reduce((sum, m) => sum + m.qty * m.cost, 0)
  return { qty, value: round(value), average: qty ? value / qty : 0 }
}
export function balance(data: Data, doc: Document) {
  const paid = data.payments.filter(p => p.document === doc.id && p.kind !== 'Refund').reduce((sum, p) => sum + p.amount, 0)
  const credits = data.docs.filter(d => d.kind === 'Return' && d.source === doc.id).reduce((sum, d) => {
    const refund = data.payments.filter(p => p.document === d.id).reduce((paid, p) => paid + p.amount, 0)
    return sum + d.total - refund
  }, 0)
  return round(doc.total - paid - credits)
}
export function partyBalance(data: Data, party: string) {
  return round(data.docs.filter(d => d.party === party && (d.kind === 'Sale' || (d.kind === 'Purchase' && d.status === 'Received'))).reduce((sum, doc) => sum + balance(data, doc), 0))
}
export function documentStatus(data: Data, doc: Document) {
  if (doc.kind === 'Return' || (doc.kind === 'Purchase' && doc.status !== 'Received')) return doc.status
  const due = balance(data, doc)
  if (due < 0) return 'Customer credit'
  if (!due) return 'Settled'
  return due < doc.total ? 'Part paid' : doc.status
}
function move(data: Data, doc: Document, item: string, qty: number, cost: number) {
  data.moves.push({ id: id('MOV', data.moves.length), document: doc.id, item, qty, cost, location: doc.location, date: now() })
}
function validateLines(data: Data, lines: Line[]) {
  if (!lines.length || lines.some(l => !data.products.some(p => p.id === l.item) || !Number.isInteger(l.qty) || l.qty <= 0 || !Number.isFinite(l.price) || l.price < 0)) throw Error('Enter a valid item, whole quantity and non-negative unit price on each line.')
}
export function createDocument(data: Data, kind: 'Purchase' | 'Sale', party: string, location: string, lines: Line[], payNow: boolean, method: string) {
  validateLines(data, lines)
  if (new Set(lines.map(line => line.item)).size !== lines.length) throw Error('Use one line per item and combine the quantities.')
  if (!data.parties.some(p => p.id === party && p.type === (kind === 'Purchase' ? 'Supplier' : 'Customer')) || !locations.some(l => l.id === location)) throw Error('Choose a valid party and warehouse.')
  const subtotal = totalLines(lines)
  const tax = round(subtotal * data.tax / 100)
  const doc: Document = { id: id(kind === 'Purchase' ? 'PO' : 'INV', data.docs.filter(d => d.kind === kind).length), kind, date: now(), party, location, lines, subtotal, tax, total: round(subtotal + tax), cost: 0, status: kind === 'Purchase' ? 'Awaiting approval' : 'Posted', received: lines.map(() => 0) }
  if (kind === 'Sale') {
    for (const line of lines) {
      const available = stock(data, line.item, location)
      if (line.qty > available.qty) throw Error('Insufficient stock for ' + data.products.find(p => p.id === line.item)?.name + '. Available: ' + available.qty + '.')
      doc.cost += available.average * line.qty
      move(data, doc, line.item, -line.qty, available.average)
    }
  }
  data.docs.unshift(doc)
  if (kind === 'Sale' && payNow && doc.total > 0) recordPayment(data, doc.id, doc.total, method)
  return doc.id
}
export function approve(data: Data, ref: string) {
  const doc = data.docs.find(d => d.id === ref)
  if (doc?.status !== 'Awaiting approval') throw Error('This purchase order is no longer awaiting approval.')
  doc.status = 'Approved'
}
export function receive(data: Data, ref: string, quantities: number[]) {
  const doc = data.docs.find(d => d.id === ref)
  if (doc?.kind !== 'Purchase' || !['Approved', 'Part received'].includes(doc.status)) throw Error('Approve the order before receiving stock.')
  if (quantities.length !== doc.lines.length || !quantities.some(q => q > 0) || quantities.some((q, i) => !Number.isInteger(q) || q < 0 || q + doc.received[i] > doc.lines[i].qty)) throw Error('Enter at least one whole quantity within the remaining order.')
  quantities.forEach((q, i) => {
    if (q) move(data, doc, doc.lines[i].item, q, doc.lines[i].price)
    doc.received[i] += q
  })
  doc.status = doc.lines.every((l,i) => l.qty === doc.received[i]) ? 'Received' : 'Part received'
}
export function recordPayment(data: Data, ref: string, amount: number, method: string) {
  const doc = data.docs.find(d => d.id === ref)
  amount = round(amount)
  if (!doc || (doc.kind !== 'Sale' && !(doc.kind === 'Purchase' && doc.status === 'Received')) || !Number.isFinite(amount) || amount <= 0 || amount > balance(data, doc)) throw Error('Enter an amount greater than zero and within the outstanding balance.')
  data.payments.unshift({ id: id('PAY', data.payments.length), date: now(), document: ref, party: doc.party, amount, method, kind: doc.kind === 'Sale' ? 'Collection' : 'Supplier payment' })
}
export function returnable(data: Data, doc: Document, item: string) {
  const quantity = (d: Document) => d.lines.filter(l => l.item === item).reduce((n, l) => n + l.qty, 0)
  return quantity(doc) - data.docs.filter(d => d.kind === 'Return' && d.source === doc.id).reduce((n, d) => n + quantity(d), 0)
}
export function recordReturn(data: Data, source: string, item: string, qty: number, disposition: string, settlement: string) {
  const invoice = data.docs.find(d => d.id === source && d.kind === 'Sale')
  const line = invoice?.lines.find(l => l.item === item)
  if (!invoice || !line || !Number.isInteger(qty) || qty <= 0 || qty > returnable(data, invoice, item)) throw Error('Choose a quantity within the eligible returned units.')
  const subtotal = round(qty * line.price)
  const tax = invoice.subtotal ? round(subtotal * invoice.tax / invoice.subtotal) : 0
  const total = round(subtotal + tax)
  const paid = data.payments.filter(p => p.document === invoice.id).reduce((n, p) => n + p.amount, 0)
  const refunded = data.payments.filter(p => p.kind === 'Refund' && data.docs.some(d => d.id === p.document && d.source === invoice.id)).reduce((n,p) => n + p.amount, 0)
  const refundable = Math.min(paid - refunded, total - Math.max(0, balance(data, invoice)))
  if (settlement === 'Refund' && refundable < total) throw Error('The invoice has an outstanding balance. Apply a credit note for this return.')
  const doc: Document = { id: id('CN', data.docs.filter(d => d.kind === 'Return').length), kind: 'Return', date: now(), party: invoice.party, location: invoice.location, lines: [{ item, qty, price: line.price }], subtotal, tax, total, cost: 0, status: settlement === 'Refund' ? 'Refunded' : 'Credited', received: [], source, disposition }
  if (disposition === 'Restock as sellable') {
    const original = data.moves.filter(m => m.document === source && m.item === item && m.qty < 0)
    const cost = original.reduce((n,m) => n - m.qty * m.cost, 0) / original.reduce((n,m) => n - m.qty, 0)
    doc.cost = cost * qty
    move(data, doc, item, qty, cost)
  }
  data.docs.unshift(doc)
  if (settlement === 'Refund' && total > 0) data.payments.unshift({ id: id('PAY', data.payments.length), date: now(), document: doc.id, party: doc.party, amount: total, method: 'Cash', kind: 'Refund' })
}
export function seed(): Data {
  const products: Product[] = [
    { id: 'p1', name: 'Basmati Rice 5 kg', sku: 'RCE-005', category: 'Grains & staples', unit: 'Bag', price: 2450, reorder: 20 },
    { id: 'p2', name: 'Sunflower Oil 1 L', sku: 'OIL-001', category: 'Cooking oils', unit: 'Bottle', price: 650, reorder: 20 },
    { id: 'p3', name: 'Black Tea 450 g', sku: 'TEA-450', category: 'Beverages', unit: 'Pack', price: 1180, reorder: 15 },
    { id: 'p4', name: 'Chickpeas 1 kg', sku: 'PLS-001', category: 'Grains & staples', unit: 'Bag', price: 460, reorder: 18 },
    { id: 'p5', name: 'Wheat Flour 10 kg', sku: 'FLR-010', category: 'Grains & staples', unit: 'Bag', price: 1560, reorder: 15 },
    { id: 'p6', name: 'Mango Nectar 1 L', sku: 'BVG-001', category: 'Beverages', unit: 'Carton', price: 370, reorder: 12 },
  ]
  const parties: Party[] = [
    { id: 'c1', name: 'Harbour Corner Mart', type: 'Customer', city: 'Karachi', phone: 'DEMO-001' },
    { id: 'c2', name: 'Gulberg Pantry', type: 'Customer', city: 'Lahore', phone: 'DEMO-002' },
    { id: 'c3', name: 'Garden Lane Grocers', type: 'Customer', city: 'Karachi', phone: 'DEMO-003' },
    { id: 's1', name: 'Mehran Grain Traders', type: 'Supplier', city: 'Hyderabad', phone: 'DEMO-004' },
    { id: 's2', name: 'Crescent Pantry Supply', type: 'Supplier', city: 'Karachi', phone: 'DEMO-005' },
  ]
  const data: Data = { products, parties, docs: [], payments: [], moves: [], tax: 0, role: 'Owner' }
  locations.forEach((loc, j) => products.forEach((p, i) => data.moves.push({ id: id('MOV', data.moves.length), document: 'Opening stock', date: past(9), location: loc.id, item: p.id, qty: [[90,17,15,86,46,30],[44,35,26,42,20,11]][j][i], cost: round(p.price * .72) })))
  const purchase = createDocument(data, 'Purchase', 's1', 'KHI', [{ item:'p1', qty:32, price:1750 },{ item:'p4',qty:30,price:310 }], false, 'Cash')
  approve(data,purchase)
  receive(data,purchase,[32,30])
  recordPayment(data,purchase,20000,'Bank transfer')
  const basketSizes = [4, 8, 5, 12, 7, 14, 9]
  basketSizes.forEach((qty, i) => {
    const ref = createDocument(data, 'Sale', ['c1','c2','c3'][i % 3], i % 2 ? 'LHR' : 'KHI', [
      { item:'p1', qty:3 + i % 2, price:2450 },
      { item:'p3', qty:1, price:1180 },
      { item:'p4', qty, price:460 },
    ], i === 4 || i === 5, 'Cash')
    const sale = data.docs.find(d => d.id === ref)!
    sale.date = past(6-i)
    data.moves.filter(m => m.document === ref).forEach(m => m.date = sale.date)
    data.payments.filter(p => p.document === ref).forEach(p => p.date = sale.date)
  })
  recordReturn(data, 'INV-0001', 'p4', 1, 'Restock as sellable', 'Credit note')
  const received = data.docs.find(d => d.id === purchase)!
  received.date = past(3)
  data.moves.filter(m => m.document === purchase).forEach(m => m.date = received.date)
  data.payments.filter(p => p.document === purchase).forEach(p => p.date = received.date)
  createDocument(data,'Purchase','s2','LHR',[{item:'p2',qty:40,price:480},{item:'p6',qty:24,price:255}],false,'Cash')
  return data
}
export function updateProduct(data:Data,id:string,values:Omit<Product,'id'>) {
  const current=data.products.find(p=>p.id===id)
  if(!current)throw Error('This item no longer exists.')
  if(!values.name.trim()||!values.sku.trim()||data.products.some(p=>p.id!==id&&p.sku.toUpperCase()===values.sku.toUpperCase()))throw Error('Enter an item name and a unique SKU.')
  if(!Number.isFinite(values.price)||values.price<0||!Number.isInteger(values.reorder)||values.reorder<0)throw Error('Enter a valid selling price and whole reorder level.')
  const inUse=data.moves.some(m=>m.item===id)||data.docs.some(d=>d.lines.some(l=>l.item===id))
  Object.assign(current,values,{unit:inUse?current.unit:values.unit})
}

export interface DemoRepository {
  load(): Data
  transact(change: (draft: Data) => void): Data
  reset(): Data
}
const key = 'blueledger-demo-v1'
export function browserRepository(storage: Pick<Storage, 'getItem' | 'setItem'>): DemoRepository {
  const save = (data: Data) => { storage.setItem(key, JSON.stringify(data)); return data }
  const load = () => {
    const saved = storage.getItem(key)
    return saved ? JSON.parse(saved) as Data : save(seed())
  }
  return { load, transact(change) { const draft = load(); change(draft); return save(draft) }, reset: () => save(seed()) }
}

