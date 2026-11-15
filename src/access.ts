export const modules = {
  Dashboard: ['view'],
  Catalogue: ['view','create','edit','delete'],
  'Customers & suppliers': ['view','create'],
  Purchasing: ['view','create','approve'],
  'Sales & POS': ['view','create'],
  Inventory: ['view'],
  Returns: ['view','create'],
  Payments: ['view','create'],
  Reports: ['view'],
  Documents: ['view','edit'],
  Administration: ['view','edit','delete'],
  'AI Assistant': ['view'],
} as const

export type Module = keyof typeof modules
export type Permission = 'view'|'create'|'edit'|'delete'|'approve'
export type Grant = (module:Module, action?:Permission)=>boolean
export const roles = ['Owner','Cashier','Storekeeper','Finance'] as const
type Role = typeof roles[number]
export type Grants = Partial<Record<Module,Permission[]>>
export type User = {id:string;name:string;email:string;role:Role;grants:Grants}
type Account = User & {salt:string; verifier:string}
const owner:User = {id:'demo-owner',name:'Amina Hassan',email:'demo@ivg.com',role:'Owner',grants:{}}
export const demoPassword = '123456'
export const demoEmail = owner.email
const accountsKey='blueledger-demo-users-v1'
const sessionKey='blueledger-demo-session-v1'
const accounts=():Account[]=>JSON.parse(localStorage.getItem(accountsKey)??'[]')
export function users():User[] {
  return [owner,...accounts().map(({id,name,email,role,grants})=>({id,name,email,role,grants}))]
}
export const currentUser=()=>users().find(user=>user.id===sessionStorage.getItem(sessionKey))
export const logout=()=>sessionStorage.removeItem(sessionKey)
export const allows=(user:User,module:Module,action:Permission='view')=>
  user.id===owner.id || Boolean(user.grants[module]?.includes('view')&&user.grants[module]?.includes(action))
export const managesUsers=(user:User)=>user.id===owner.id

async function verifier(password:string,salt:string) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+password))
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')
}
export async function signIn(email:string,password:string):Promise<User> {
  email=email.trim().toLowerCase()
  const account=accounts().find(u=>u.email===email)
  const id=email===owner.email&&password===demoPassword?owner.id
    :account&&await verifier(password,account.salt)===account.verifier?account.id:undefined
  const user=users().find(u=>u.id===id)
  if(!user)throw Error('Check your email and password.')
  sessionStorage.setItem(sessionKey,user.id)
  return user
}

export async function createUser(actor:User, input:{name:string;email:string;password:string;role:Role;grants:Grants}) {
  if(!managesUsers(actor)||currentUser()?.id!==actor.id)throw Error('Only the demo owner can create users.')
  const name=input.name.trim(),email=input.email.trim().toLowerCase()
  if(!name||!email||input.password.length<6||!roles.includes(input.role))throw Error('Enter a name, email, role and a password of at least six characters.')
  const grants:Grants={}
  for(const module of Object.keys(modules) as Module[]) {
    const selected=input.grants[module]
    if(selected?.includes('view'))grants[module]=modules[module].filter(action=>selected.includes(action))
  }
  if(!Object.keys(grants).length)throw Error('Select View for at least one module.')
  const salt=crypto.randomUUID()
  const hash=await verifier(input.password,salt)
  if(currentUser()?.id!==actor.id)throw Error('Your session ended. Sign in again.')
  const existing=accounts()
  if(email===owner.email||existing.some(u=>u.email===email))throw Error('That email is already in use.')
  localStorage.setItem(accountsKey,JSON.stringify([...existing,{id:crypto.randomUUID(),name,email,role:input.role,grants,salt,verifier:hash}]))
}

