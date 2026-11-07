import lesson5 from './lesson-five-content.json' with {type:'json'};
import lesson6 from './lesson-6-content.json' with {type:'json'};
import lesson7 from './lesson-7-content.json' with {type:'json'};
import lesson8 from './lesson-8-content.json' with {type:'json'};
import lesson9 from './lesson-9-content.json' with {type:'json'};
import lesson10 from './lesson-10-content.json' with {type:'json'};
import lesson11 from './lesson-11-content.json' with {type:'json'};
import lesson12 from './lesson-12-content.json' with {type:'json'};
import lesson13 from './lesson-13-content.json' with {type:'json'};
// Exact accepted content, projected to immutable identifiers only. No answer,
// learner, watch or completion authority is created by this catalog.
const contracts=Object.fromEntries([1,2,3,4].map(lesson=>[lesson,Object.freeze({
 lesson,worksheet:null,questions:Object.freeze(Array.from({length:20},(_,i)=>i+1))
})]));
for(const content of [lesson5,lesson6,lesson7,lesson8,lesson9,lesson10,lesson11,lesson12,lesson13]){
 const questions=content.responseGroups.map(group=>group.id);
 if(!Number.isInteger(content.lesson)||content.lesson<5||content.lesson>13||
    content.worksheet!==`lesson-${content.lesson}-workbook-sections-v1`||
    !questions.length||questions.some((id,i)=>id!==i+1)||contracts[content.lesson])
  throw Error('Approved worksheet catalog invalid');
 contracts[content.lesson]=Object.freeze({lesson:content.lesson,worksheet:content.worksheet,questions:Object.freeze(questions)});
}
export const WORKSHEET_CONTRACTS=Object.freeze(contracts);
