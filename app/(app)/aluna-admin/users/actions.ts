'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAlunaSuperAdmin} from '@/lib/aluna-admin';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function moderateAlunaUser(form:FormData){
 const id=String(form.get('profile_id')??'');
 const decision=String(form.get('decision')??'');
 const reason=String(form.get('reason')??'').trim();
 const dest='/aluna-admin/users';
 if(!uuid.test(id)||!['suspended','reactivated'].includes(decision)||reason.length<8||reason.length>500)
  redirect(dest+'?error=validation');
 const {user,db}=await requireAlunaSuperAdmin();
 if(id===user.id)redirect(dest+'?error=self-protection');
 const {data:protectedRole,error:roleError}=await db.from('aluna_super_admins').select('profile_id').eq('profile_id',id).maybeSingle();
 if(roleError||protectedRole)redirect(dest+'?error=protected');
 const {data:target,error:lookupError}=await db.auth.admin.getUserById(id);
 if(lookupError||!target?.user)redirect(dest+'?error=user');
 const now=Date.now();
 const currentlyBanned=Boolean(target.user.banned_until&&new Date(target.user.banned_until).getTime()>now);
 if((decision==='suspended')===currentlyBanned)redirect(dest+'?error=unchanged');
 const {error:updateError}=await db.auth.admin.updateUserById(id,{ban_duration:decision==='suspended'?'876000h':'none'});
 if(updateError)redirect(dest+'?error=moderation');
 const {error:auditError}=await db.from('aluna_profile_moderation_audit').insert({profile_id:id,actor_id:user.id,action:decision,reason});
 if(auditError)redirect(dest+'?error=audit');
 revalidatePath(dest);
 redirect(dest+'?status='+decision);
}
