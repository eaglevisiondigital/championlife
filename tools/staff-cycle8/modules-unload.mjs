// Existing narrow Mac-observed classifier, extracted without expanding acceptance.
// Linux's recorded empty-cancellation diagnostics intentionally remain rejected.
export function knownUnload({engine,moduleName,error,failedRequests,navigations,backend,sdkUrl,otherOrg}){
 return engine==='webkit'&&moduleName==='Forms'&&error.phase==='account-replacement'&&error.message==='/synthetic-modules.supabase.co/auth/v1/user due to access control checks.'&&error.stack.includes(sdkUrl)&&error.stack.includes('_useSession')&&failedRequests.some(r=>r.phase===error.phase&&r.url===backend+'/rest/v1/rpc/forms_workspace'&&r.failure?.errorText==='cancelled'&&Math.abs(r.time-error.time)<=100)&&navigations.some(n=>n.phase===error.phase&&new URL(n.url).pathname==='/discipleship-login.html'&&new URL(n.url).searchParams.get('next')==='/staff-forms.html?organization='+otherOrg&&Math.abs(n.time-error.time)<=250);
}
