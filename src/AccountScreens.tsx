import {useState,type FormEvent} from 'react'
import {Layers3,LogIn,UserPlus} from 'lucide-react'
import {createUser,demoEmail,demoPassword,modules,roles,signIn,users,type Grants,type Module,type Permission,type User} from './access'
import {Field,Panel,Table} from './ui'
import './accounts.css'

export function Login({onLogin}:{onLogin:(user:User)=>void}) {
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form=new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {onLogin(await signIn(String(form.get('email')),String(form.get('password'))))}
    catch(e){setError(e instanceof Error?e.message:'Sign-in failed.')}
    finally{setBusy(false)}
  }
  return <main className="account-login">
    <section className="account-brand">
      <span className="brand-mark"><Layers3 size={23}/></span>
      <h1>Blueledger</h1>
      <p>Manage inventory, purchasing, sales and billing in one workspace.</p>
    </section>
    <section className="account-signin">
      <h2>Sign in</h2>
      <p>Access the Inventory &amp; Billing demo.</p>
      <form onSubmit={submit}>
        <Field label="Email"><input name="email" type="email" autoComplete="username" required/></Field>
        <Field label="Password"><input name="password" type="password" autoComplete="current-password" required/></Field>
        {error&&<p className="account-message" role="alert">{error}</p>}
        <button className="primary" disabled={busy}><LogIn size={16}/>{busy?'Signing in…':'Sign in'}</button>
      </form>
      <div className="account-demo"><strong>Demo credentials</strong><dl><dt>Email</dt><dd>{demoEmail}</dd><dt>Password</dt><dd>{demoPassword}</dd></dl></div>
      <p className="account-local">Local demo access. Use fictional credentials only.</p>
    </section>
  </main>
}

export function UserManagement({user}:{user:User}) {
  const [accounts,setAccounts]=useState(users)
  const [grants,setGrants]=useState<Grants>({})
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  function toggle(module:Module,action:Permission,checked:boolean) {
    setGrants(previous=>{
      const current=previous[module]??[]
      const next=checked?[...current,action]:action==='view'?[]:current.filter(x=>x!==action)
      return {...previous,[module]:next}
    })
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element=event.currentTarget
    const form=new FormData(element)
    setBusy(true)
    setNotice('')
    setError('')
    try {
      await createUser(user,{name:String(form.get('name')),email:String(form.get('email')),password:String(form.get('password')),role:String(form.get('role')) as User['role'],grants})
      setAccounts(users())
      setGrants({})
      element.reset()
      setNotice('User created. They can sign in using this browser profile.')
    } catch(e){setError(e instanceof Error?e.message:'Could not create the user.')}
    finally{setBusy(false)}
  }
  return <>
    <Panel title="Create user" note="Choose a role and grant access to individual modules.">
      <form className="form account-create" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name"><input name="name" required/></Field>
          <Field label="Login email"><input name="email" type="email" required/></Field>
          <Field label="Login password"><input name="password" type="password" autoComplete="new-password" minLength={6} required/></Field>
          <Field label="Role"><select name="role" defaultValue="Storekeeper">{roles.map(role=><option key={role}>{role}</option>)}</select></Field>
        </div>
        <div className="table-scroll"><table className="account-permissions">
          <thead><tr><th scope="col">Module</th>{['View','Create','Edit','Delete','Approve'].map(action=><th scope="col" key={action}>{action}</th>)}</tr></thead>
          <tbody>{(Object.keys(modules) as Module[]).map(module=><tr key={module}><th scope="row">{module}</th>
            {(['view','create','edit','delete','approve'] as const).map(action=><td key={action}>{(modules[module] as readonly Permission[]).includes(action)?<input type="checkbox" aria-label={module+' '+action} checked={!!grants[module]?.includes(action)} disabled={action!=='view'&&!grants[module]?.includes('view')} onChange={e=>toggle(module,action,e.target.checked)}/>:<span aria-hidden="true">—</span>}</td>)}
          </tr>)}</tbody>
        </table></div>
        {error&&<p className="account-message" role="alert">{error}</p>}
        {notice&&<p role="status">{notice}</p>}
        <button className="primary" disabled={busy}><UserPlus size={16}/> Create user</button>
      </form>
    </Panel>
    <Panel title="Demo users"><Table headers={['Name','Email','Role','Module access']} rows={accounts.map(account=>[account.name,account.email,account.role,account.id===user.id?'All modules':Object.entries(account.grants).filter(([,actions])=>actions.includes('view')).map(([module])=>module).join(', ')])}/></Panel>
  </>
}

