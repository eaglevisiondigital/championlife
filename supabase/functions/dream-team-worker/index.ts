import {PDFDocument,rgb} from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import {applicationPdf} from '../_shared/dream-team-pdf.mjs';
import {fontBytes,logoBytes} from '../_shared/dream-team-assets.mjs';
import {createWorker} from './handler.mjs';
Deno.serve(createWorker({workerSecret:Deno.env.get('DREAM_TEAM_WORKER_SECRET')!,url:Deno.env.get('SUPABASE_URL')!,anonKey:Deno.env.get('SUPABASE_ANON_KEY')!,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,renderPdf:s=>applicationPdf(s,{PDFDocument,rgb,fontkit,fontBytes,logoBytes})}));
