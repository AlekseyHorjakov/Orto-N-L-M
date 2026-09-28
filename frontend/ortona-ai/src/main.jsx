import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ChevronDown, ChevronRight, Users, UserRound, GraduationCap, MessageCircle, BriefcaseBusiness, FileText, ClipboardList, Send, Paperclip, Plus, Pencil, Trash2, X, Check, ArrowLeft, Search } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const getInitialView = role => {
 if(role === "manager") return {active:"manager",section:"home"};
 if(role === "specialist") return {active:"specialist",section:"chat"};
 return {active:"trainee",section:"chat"};
};

const menu=[
 {key:"manager",label:"Руководитель",icon:UserRound,roles:["manager"]},
 {key:"specialist",label:"Специалист",icon:Users,roles:["manager","specialist"]},
 {key:"trainee",label:"Стажер",icon:GraduationCap,roles:["manager","specialist","trainee"]},
 {key:"question",label:"Задать вопрос",icon:MessageCircle,roles:["manager","specialist","trainee"]}
];

const defaultInstructions=[
 {id:1,title:"Прием нового пациента",position:"Администратор",text:"Порядок действий администратора при первичном обращении пациента."},
 {id:2,title:"Оформление пациента",position:"Администратор",text:"Основные правила оформления и передачи информации."},
 {id:3,title:"Работа с заказом",position:"Протезист",text:"Порядок работы с заказом и документацией."}
];

function App(){
 const [authenticated,setAuthenticated]=useState(false);
 const [login,setLogin]=useState("");
 const [password,setPassword]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [loginError,setLoginError]=useState("");
 const [currentUser,setCurrentUser]=useState(null);

 const [active,setActive]=useState("manager");
 const [section,setSection]=useState("home");

 const [positions,setPositions]=useState([]);
 const [instructions,setInstructions]=useState([]);

 const [editingPosition,setEditingPosition]=useState(null);
 const [positionDraft,setPositionDraft]=useState("");
 const [addingPosition,setAddingPosition]=useState(false);

 const [editingInstruction,setEditingInstruction]=useState(null);
 const [addingInstruction,setAddingInstruction]=useState(false);
 const [instructionDraft,setInstructionDraft]=useState({title:"",position:"",text:""});

 const [specialistPosition,setSpecialistPosition]=useState("");
 const [selectedInstruction,setSelectedInstruction]=useState(null);
 const [selectedTraineeInstruction,setSelectedTraineeInstruction]=useState(null);
 const [instructionSearch,setInstructionSearch]=useState("");

 const [message,setMessage]=useState("");
 const [questionAsked,setQuestionAsked]=useState("");
 const [questionTransitioning,setQuestionTransitioning]=useState(false);
 const [traineePosition,setTraineePosition]=useState("");
 const [learnedInstructions,setLearnedInstructions]=useState([]);
 const [learnedSavingId,setLearnedSavingId]=useState(null);
 const [traineeError,setTraineeError]=useState("");
 const [openedTraineeInstructions,setOpenedTraineeInstructions]=useState([]);
 const [testingInstruction,setTestingInstruction]=useState(null);
 const [testQuestions,setTestQuestions]=useState([]);
 const [testLoading,setTestLoading]=useState(false);
 const [testError,setTestError]=useState("");
 const [testPassPercent,setTestPassPercent]=useState(80);
 const [testSaving,setTestSaving]=useState(false);
 const [testSaveError,setTestSaveError]=useState("");
 const [testResults,setTestResults]=useState({});
 const [testDetails,setTestDetails]=useState({});
 const [testStep,setTestStep]=useState(0);
 const [testAnswer,setTestAnswer]=useState(null);
 const [testScore,setTestScore]=useState(0);
 const [testFinished,setTestFinished]=useState(false);
 const [interviewOpen,setInterviewOpen]=useState(false);
 const [interviewStep,setInterviewStep]=useState(1);
 const [interviewAnswer,setInterviewAnswer]=useState("");
 const [interviewHistory,setInterviewHistory]=useState([]);
 const [interviewLoading,setInterviewLoading]=useState(false);
 const [interviewError,setInterviewError]=useState("");
 const [interviewProcess,setInterviewProcess]=useState(null);
 const [interviewSavedNote,setInterviewSavedNote]=useState("");
 const [interviewScreenshot,setInterviewScreenshot]=useState(null);
 const [interviewScreenshotRequest,setInterviewScreenshotRequest]=useState(false);
 const [interviewSavedProcessId,setInterviewSavedProcessId]=useState(null);
 const [interviewInstructionLoading,setInterviewInstructionLoading]=useState(false);
 const [interviewInstructionError,setInterviewInstructionError]=useState("");
 const [instructionTextLoading,setInstructionTextLoading]=useState(false);
 const [instructionTextError,setInstructionTextError]=useState("");
 const [interviewFinished,setInterviewFinished]=useState(false);
 const [interviewSaveFailed,setInterviewSaveFailed]=useState(false);
 const [interviewAttachments,setInterviewAttachments]=useState([]);
 const [interviewPendingStep,setInterviewPendingStep]=useState(null);
 const [questionChat,setQuestionChat]=useState([]);
 const [questionLoading,setQuestionLoading]=useState(false);
 const [questionError,setQuestionError]=useState("");
 const [instructionEditing,setInstructionEditing]=useState(false);
 const [instructionEditDraft,setInstructionEditDraft]=useState("");
 const [instructionActionLoading,setInstructionActionLoading]=useState(false);
 const [instructionActionError,setInstructionActionError]=useState("");
 const [instructionActionNote,setInstructionActionNote]=useState("");
 const interviewFileRef=useRef(null);
 const testRequestRef=useRef(0);

 const [users,setUsers]=useState([]);
 const [usersLoading,setUsersLoading]=useState(false);
 const [userError,setUserError]=useState("");
 const [addingUser,setAddingUser]=useState(false);
 const [userDraft,setUserDraft]=useState({full_name:"",username:"",password:"",role:"specialist",position_id:null});
 const [editingUser,setEditingUser]=useState(null);
 const [userEditDraft,setUserEditDraft]=useState({full_name:"",role:"specialist",position_id:null});

 const [managerResults,setManagerResults]=useState([]);
 const [managerResultsLoading,setManagerResultsLoading]=useState(false);
 const [managerResultsError,setManagerResultsError]=useState("");
 const [managerResultsUser,setManagerResultsUser]=useState("");
 const [managerResultsPosition,setManagerResultsPosition]=useState("");

 useEffect(()=>{
  const token=localStorage.getItem("ortona_access_token");

  if(!token)return;

  fetch(`${API_URL}/auth/me`,{
   headers:{
    Authorization:`Bearer ${token}`
   }
  })
   .then(async response=>{
    if(!response.ok)throw new Error("Сессия недействительна");
    return response.json();
   })
   .then(user=>{
    setCurrentUser(user);
    setAuthenticated(true);
    const initialView=getInitialView(user.role);
    setActive(initialView.active);
    setSection(initialView.section);
   })
   .catch(()=>{
    localStorage.removeItem("ortona_access_token");
    localStorage.removeItem("ortona_user");
    setCurrentUser(null);
    setAuthenticated(false);
   });
 },[]);

 useEffect(()=>{
  if(!authenticated)return;

  const token=localStorage.getItem("ortona_access_token");
  if(!token)return;

  const headers={Authorization:`Bearer ${token}`};

  fetch(`${API_URL}/positions`,{
   headers
  })
   .then(async response=>{
    if(!response.ok)throw new Error("Не удалось загрузить должности");
    return response.json();
   })
   .then(data=>{
    setPositions(data);
   })
   .catch(error=>{
    console.error("Ошибка загрузки должностей:",error);
    setPositions([]);
   });

  fetch(`${API_URL}/processes`,{
   headers
  })
   .then(async response=>{
    if(!response.ok)throw new Error("Не удалось загрузить инструкции");
    return response.json();
   })
   .then(data=>{
    setInstructions(data);
   })
   .catch(error=>{
    console.error("Ошибка загрузки инструкций:",error);
    setInstructions([]);
   });
 },[authenticated]);

 useEffect(()=>{
  if(!authenticated)return;

  const token=localStorage.getItem("ortona_access_token");
  if(!token)return;

  fetch(`${API_URL}/test-results`,{
   headers:{Authorization:`Bearer ${token}`}
  })
   .then(async response=>{
    if(!response.ok)throw new Error("Не удалось загрузить результаты тестов");
    return response.json();
   })
   .then(data=>{
    const passPercent=Number.isFinite(data?.pass_percent)?data.pass_percent:80;
    const rows=Array.isArray(data?.results)?data.results:[];
    const results={};
    const details={};

    rows.forEach(row=>{
     const percent=Number(row?.best_percent);

     if(row?.process_id===undefined||!Number.isFinite(percent))return;

     results[row.process_id]=percent;
     details[row.process_id]={
      percent,
      score:Number(row?.best_score)||0,
      total:Number(row?.best_total)||0,
      attempts:Number(row?.attempts)||0,
      passed:percent>=passPercent,
      lastAt:row?.last_at||""
     };
    });

    setTestPassPercent(passPercent);
    setTestResults(results);
    setTestDetails(details);
    setLearnedInstructions(
     Array.isArray(data?.learned_process_ids)?data.learned_process_ids:[]
    );
   })
   .catch(error=>{
    console.error("Ошибка загрузки результатов тестов:",error);
   });
 },[authenticated]);

 useEffect(()=>{
  if(!currentUser||!positions.length)return;
  const assignedPosition=positions.find(
   position=>Number(position.id)===Number(currentUser.position_id)
  )?.name||"";
  if(currentUser.role==="specialist")setSpecialistPosition(assignedPosition);
  if(currentUser.role==="trainee")setTraineePosition(assignedPosition);
 },[currentUser,positions]);

 const selectMenu=key=>{
  setActive(key);
  setSection(key==="manager"?"home":key==="users"?"users":"chat");
  setSelectedInstruction(null);
 };

 const getAuthHeaders=()=>{
  const token=localStorage.getItem("ortona_access_token");
  return token?{Authorization:`Bearer ${token}`} : {};
 };

 const formatDateTime=value=>{
  if(!value)return "—";

  const date=new Date(value);

  return Number.isNaN(date.getTime())
   ?"—"
   :date.toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
 };

 const fileUrlForAttachment=attachment=>{
  if(!attachment)return "";
  const token=localStorage.getItem("ortona_access_token")||"";
  const base=attachment.url&&String(attachment.url).startsWith("/api/")
   ?attachment.url
   :(attachment.file_id?`${API_URL}/files/${attachment.file_id}`:"");
  if(!base)return "";
  return token?`${base}?token=${encodeURIComponent(token)}`:base;
 };

 const attachmentStepMarker=text=>{
  const match=String(text||"").match(/\[SCREENSHOT_REQUEST:([^\]]{1,40})\]/);
  return match?match[1].trim():null;
 };

 const sanitizeProcessJsonAttachments=(processJson,knownAttachments)=>{
  if(!processJson||typeof processJson!=="object")return processJson;

  const knownIds=new Set(
   (knownAttachments||[])
    .map(item=>Number(item?.file_id))
    .filter(id=>Number.isFinite(id))
  );

  const copy=JSON.parse(JSON.stringify(processJson));

  if(Array.isArray(copy.steps)){
   copy.steps.forEach(step=>{
    if(!step||!Array.isArray(step.attachments))return;
    step.attachments=step.attachments.filter(attachment=>
     attachment&&typeof attachment==="object"&&knownIds.has(Number(attachment.file_id))
    );
   });
  }

  return copy;
 };

 const mergeStoredAttachments=(processJson,storedAttachments)=>{
  if(!processJson||!storedAttachments?.length)return processJson;

  const copy=JSON.parse(JSON.stringify(processJson));
  if(!Array.isArray(copy.steps)||!copy.steps.length)return copy;

  const existing=new Set();
  copy.steps.forEach(step=>{
   (Array.isArray(step?.attachments)?step.attachments:[]).forEach(attachment=>{
    if(attachment&&attachment.file_id!==undefined)existing.add(Number(attachment.file_id));
   });
  });

  storedAttachments.forEach(stored=>{
   const fileId=Number(stored?.file_id);
   if(!Number.isFinite(fileId)||existing.has(fileId))return;

   let step=null;
   if(stored.step_id)step=copy.steps.find(item=>String(item?.id)===String(stored.step_id));
   if(!step){
    step=copy.steps.find(item=>!(Array.isArray(item?.attachments)&&item.attachments.some(a=>a&&a.file_id!==undefined)))
     ||copy.steps[0];
   }
   if(!step)return;

   if(!Array.isArray(step.attachments))step.attachments=[];
   step.attachments.push({
    type:"screenshot",
    file_id:fileId,
    url:stored.url||`/api/files/${fileId}`,
    mime_type:stored.mime_type||"image/png",
    caption:""
   });
   existing.add(fileId);
  });

  return copy;
 };

 const renderProcessSteps=processJson=>{
  const steps=Array.isArray(processJson?.steps)?processJson.steps:[];
  if(!steps.length)return null;

  return <div className="process-steps">
   <span className="specialist-document-instruction-label">Шаги процесса</span>
   {steps.map((step,index)=>{
    const attachments=(Array.isArray(step?.attachments)?step.attachments:[])
     .filter(attachment=>attachment&&(attachment.file_id||attachment.url));

    return <div className="process-step" key={step?.id||index}>
     <h4>{index+1}. {step?.title||`Шаг ${index+1}`}</h4>
     {step?.instruction&&<p>{step.instruction}</p>}
     {step?.expected_result&&
      <p className="process-step-result">Ожидаемый результат: {step.expected_result}</p>
     }
     {attachments.length>0&&
      <div className="process-step-attachments">
       {attachments.map((attachment,attachmentIndex)=>
        <figure className="process-step-attachment" key={`${attachment.file_id||attachment.url}-${attachmentIndex}`}>
         <img
          src={fileUrlForAttachment(attachment)}
          alt={attachment.caption||`Скриншот шага ${index+1}`}
          loading="lazy"
         />
         {attachment.caption&&<figcaption>{attachment.caption}</figcaption>}
        </figure>
       )}
      </div>
     }
    </div>;
   })}
  </div>;
 };

 const loadUsers=async()=>{
  setUsersLoading(true);
  setUserError("");

  try{
   const response=await fetch(`${API_URL}/users`,{
    headers:getAuthHeaders()
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось загрузить пользователей");
   }

   setUsers(data);
  }catch(error){
   setUserError(error.message||"Не удалось загрузить пользователей");
  }finally{
   setUsersLoading(false);
  }
 };

 const openUsers=()=>{
  setSection("users");
  setAddingUser(false);
  setEditingUser(null);
  setUserDraft({full_name:"",username:"",password:"",role:"specialist",position_id:null});
  loadUsers();
 };

 const saveNewUser=async()=>{
  const full_name=userDraft.full_name.trim();
  const username=userDraft.username.trim();
  const password=userDraft.password;

  if(!full_name||!username||!password){
   setUserError("Заполните ФИО, логин и пароль");
   return;
  }

  if(userDraft.role!=="manager"&&!userDraft.position_id){
   setUserError("Выберите должность сотрудника");
   return;
  }

  setUserError("");

  try{
   const response=await fetch(`${API_URL}/users`,{
    method:"POST",
    headers:{
     ...getAuthHeaders(),
     "Content-Type":"application/json"
    },
    body:JSON.stringify({
     username,
     full_name,
     password,
     role:userDraft.role,
     position_id:userDraft.position_id||null
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось создать пользователя");
   }

   setUserDraft({full_name:"",username:"",password:"",role:"specialist",position_id:null});
   setAddingUser(false);
   await loadUsers();
  }catch(error){
   setUserError(error.message||"Не удалось создать пользователя");
  }
 };


 const closeTraineeInstruction=()=>{
  if(selectedTraineeInstruction){
   setOpenedTraineeInstructions(prev=>
    prev.includes(selectedTraineeInstruction.id)
     ? prev
     : [...prev,selectedTraineeInstruction.id]
   );
  }
  setSelectedTraineeInstruction(null);
};

const startTest=async item=>{
  if(!item)return;

  const requestId=testRequestRef.current+1;
  testRequestRef.current=requestId;

  setTestingInstruction(item);
  setTestStep(0);
  setTestAnswer(null);
  setTestScore(0);
  setTestFinished(false);
  setTestError("");
  setTestSaveError("");
  setTestQuestions([]);

  if(!item.process_json){
   setTestError("Для этой инструкции не сохранён Process JSON, тест недоступен. Обратитесь к руководителю.");
   return;
  }

  setTestLoading(true);

  try{
   const response=await fetch(`${API_URL}/ai/test`,{
    method:"POST",
    headers:{
     "Content-Type":"application/json",
     ...getAuthHeaders()
    },
    body:JSON.stringify({
     process_json:item.process_json,
     process_id:item.id
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось сформировать тест по инструкции");
   }

   const questions=Array.isArray(data?.questions)
    ?data.questions.filter(question=>
      question&&
      typeof question.question==="string"&&
      Array.isArray(question.options)&&
      question.options.length===4&&
      new Set(question.options.map(option=>String(option?.text||"").trim().toLowerCase())).size===4&&
      question.options.filter(option=>option&&option.correct===true).length===1
     )
    :[];

   if(!questions.length){
    throw new Error("AI не сформировал ни одного вопроса по этому процессу");
   }

   if(testRequestRef.current!==requestId)return;

   if(Number.isFinite(data?.pass_percent))setTestPassPercent(data.pass_percent);

   setTestQuestions(questions);
  }catch(error){
   if(testRequestRef.current===requestId){
    setTestError(error.message||"Не удалось сформировать тест по инструкции");
   }
  }finally{
   if(testRequestRef.current===requestId)setTestLoading(false);
  }
 };

 const closeTest=()=>{
  testRequestRef.current+=1;
  setTestLoading(false);
  setTestingInstruction(null);
  setTestQuestions([]);
  setTestStep(0);
  setTestAnswer(null);
  setTestScore(0);
  setTestFinished(false);
  setTestError("");
  setTestSaveError("");
 };

 const saveTestResult=async(processId,score,total)=>{
  setTestSaveError("");
  setTestSaving(true);

  try{
   const response=await fetch(`${API_URL}/test-results`,{
    method:"POST",
    headers:{
     "Content-Type":"application/json",
     ...getAuthHeaders()
    },
    body:JSON.stringify({
     process_id:processId,
     score,
     total
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось сохранить результат теста");
   }

   const passPercent=Number.isFinite(data?.pass_percent)?data.pass_percent:testPassPercent;

   if(Number.isFinite(data?.percent)){
    setTestResults(prev=>({
     ...prev,
     [processId]:data.percent
    }));

    setTestDetails(prev=>({
     ...prev,
     [processId]:{
      percent:data.percent,
      score:Number(data?.score)||0,
      total:Number(data?.total)||0,
      attempts:(prev[processId]?.attempts||0)+1,
      passed:data.percent>=passPercent,
      lastAt:data?.created_at||""
     }
    }));
   }

   setTestPassPercent(passPercent);

   return data;
  }catch(error){
   setTestSaveError(error.message||"Не удалось сохранить результат теста");
   return null;
  }finally{
   setTestSaving(false);
  }
 };

 const toggleLearned=async item=>{
  if(!item||learnedSavingId===item.id)return;

  const learned=learnedInstructions.includes(item.id);

  setTraineeError("");
  setLearnedSavingId(item.id);

  try{
   const response=await fetch(
    learned
     ?`${API_URL}/learned-instructions/${item.id}`
     :`${API_URL}/learned-instructions`,
    {
     method:learned?"DELETE":"POST",
     headers:learned?getAuthHeaders():{
      "Content-Type":"application/json",
      ...getAuthHeaders()
     },
     body:learned?undefined:JSON.stringify({process_id:item.id})
    }
   );

   if(!response.ok){
    const data=await response.json().catch(()=>null);
    throw new Error(data?.detail||"Не удалось сохранить отметку «изучено»");
   }

   setLearnedInstructions(prev=>
    learned
     ?prev.filter(id=>id!==item.id)
     :(prev.includes(item.id)?prev:[...prev,item.id])
   );
  }catch(error){
   setTraineeError(error.message||"Не удалось сохранить отметку «изучено»");
  }finally{
   setLearnedSavingId(null);
  }
 };

 const submitTest=()=>{
  if(testAnswer===null||!testQuestions.length)return;

  const current=testQuestions[testStep];
  const options=Array.isArray(current?.options)?current.options:[];
  const correctIndex=options.findIndex(option=>option&&option.correct===true);
  const nextScore=testScore+(testAnswer===correctIndex?1:0);

  setTestScore(nextScore);

  if(testStep<testQuestions.length-1){
   setTestStep(testStep+1);
   setTestAnswer(null);
   return;
  }

  const percent=Math.round((nextScore/testQuestions.length)*100);

  if(testingInstruction){
   setTestResults(prev=>({
    ...prev,
    [testingInstruction.id]:percent
   }));

   saveTestResult(testingInstruction.id,nextScore,testQuestions.length);
  }

  setTestFinished(true);
 };

 const openPositions=()=>{
  setSection("positions");
  setEditingPosition(null);
  setAddingPosition(false);
 };

 const openInstructions=()=>{
  setSection("instructions");
  setEditingInstruction(null);
  setAddingInstruction(false);
 };

 const loadManagerResults=async(filters={})=>{
  const userId=filters.user_id!==undefined?filters.user_id:managerResultsUser;
  const positionId=filters.position_id!==undefined?filters.position_id:managerResultsPosition;

  setManagerResultsLoading(true);
  setManagerResultsError("");

  try{
   const params=new URLSearchParams();

   if(userId)params.set("user_id",userId);
   if(positionId)params.set("position_id",positionId);

   const query=params.toString();

   const response=await fetch(`${API_URL}/manager/test-results${query?`?${query}`:""}`,{
    headers:getAuthHeaders()
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось загрузить результаты тестов");
   }

   setManagerResults(Array.isArray(data?.results)?data.results:[]);
  }catch(error){
   setManagerResults([]);
   setManagerResultsError(error.message||"Не удалось загрузить результаты тестов");
  }finally{
   setManagerResultsLoading(false);
  }
 };

 const openTestResults=()=>{
  setSection("test-results");
  setManagerResultsUser("");
  setManagerResultsPosition("");
  setManagerResultsError("");
  loadUsers();
  loadManagerResults({user_id:"",position_id:""});
 };

 const changeManagerResultUser=value=>{
  setManagerResultsUser(value);
  loadManagerResults({user_id:value});
 };

 const changeManagerResultPosition=value=>{
  setManagerResultsPosition(value);
  loadManagerResults({position_id:value});
 };

 const addPosition=()=>{
  setAddingPosition(true);
  setEditingPosition(null);
  setPositionDraft("");
 };

 const loadPositions=async()=>{
  try{
   const response=await fetch(`${API_URL}/positions`,{
    headers:getAuthHeaders()
   });

   const data=await response.json();

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось загрузить должности");
   }

   setPositions(data);
  }catch(error){
   console.error("Ошибка загрузки должностей:",error);
  }
 };
 const saveNewPosition=async()=>{
  const value=positionDraft.trim();
  if(!value)return;

  try{
   const response=await fetch(`${API_URL}/positions`,{
    method:"POST",
    headers:{"Content-Type":"application/json",...getAuthHeaders()},
    body:JSON.stringify({name:value})
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось добавить должность");
   }

   setPositions(prev=>[...prev,data]);
   setPositionDraft("");
   setAddingPosition(false);
  }catch(error){
   alert(error.message||"Не удалось добавить должность");
  }
 };

 const startEditPosition=index=>{
  setEditingPosition(index);
  setAddingPosition(false);
  setPositionDraft(positions[index]?.name||"");
 };


const savePosition=async()=>{
  const value=positionDraft.trim();
  if(!value||editingPosition===null)return;

  const position=positions[editingPosition];
  if(!position?.id){
   alert("У должности отсутствует ID базы данных");
   return;
  }

  try{
   const response=await fetch(`${API_URL}/positions/${position.id}`,{
    method:"PUT",
    headers:{"Content-Type":"application/json",...getAuthHeaders()},
    body:JSON.stringify({name:value})
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось изменить должность");
   }

   setPositions(prev=>prev.map(item=>item.id===position.id?data:item));
   setEditingPosition(null);
   setPositionDraft("");
  }catch(error){
   alert(error.message||"Не удалось изменить должность");
  }
 };

 const removePosition=async index=>{
  const position=positions[index];
  if(!position)return;

  if(!window.confirm(`Удалить должность «${position.name||position}»?`))return;

  try{
   const positionId=position.id;

   if(!positionId){
    throw new Error("У должности отсутствует ID базы данных");
   }

   const response=await fetch(`${API_URL}/positions/${positionId}`,{
    method:"DELETE",
    headers:getAuthHeaders()
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось удалить должность");
   }

   setPositions(prev=>prev.filter(item=>item.id!==positionId));
  }catch(error){
   alert(error.message||"Не удалось удалить должность");
  }
 };

 const startAddInstruction=()=>{
  setAddingInstruction(true);
  setEditingInstruction(null);
  setInstructionDraft({title:"",position:positions[0]?.name||"",text:""});
 };

 const startEditUser=user=>{
  setAddingUser(false);
  setUserError("");
  setEditingUser(user.id);
  setUserEditDraft({
    full_name:user.full_name||"",
    role:user.role,
    position_id:user.position_id||null
   });
 };

 const saveEditedUser=async()=>{
  const full_name=userEditDraft.full_name.trim();

  if(!full_name||editingUser===null){
   setUserError("Введите ФИО сотрудника");
   return;
  }

  if(userEditDraft.role!=="manager"&&!userEditDraft.position_id){
   setUserError("Выберите должность сотрудника");
   return;
  }

  try{
   const response=await fetch(`${API_URL}/users/${editingUser}`,{
    method:"PUT",
    headers:{...getAuthHeaders(),"Content-Type":"application/json"},
    body:JSON.stringify({full_name,role:userEditDraft.role,position_id:userEditDraft.position_id||null})
   });
   const data=await response.json().catch(()=>null);

   if(!response.ok)throw new Error(data?.detail||"Не удалось изменить пользователя");

   setUsers(prev=>prev.map(user=>user.id===editingUser?data:user));
   setEditingUser(null);
  }catch(error){
   setUserError(error.message||"Не удалось изменить пользователя");
  }
 };

 const removeUser=async user=>{
  if(!window.confirm(`Удалить пользователя «${user.full_name||user.username}»?`))return;

  try{
   const response=await fetch(`${API_URL}/users/${user.id}`,{
    method:"DELETE",
    headers:getAuthHeaders()
   });
   const data=await response.json().catch(()=>null);

   if(!response.ok)throw new Error(data?.detail||"Не удалось удалить пользователя");

   setUsers(prev=>prev.filter(item=>item.id!==user.id));
  }catch(error){
   setUserError(error.message||"Не удалось удалить пользователя");
  }
 };

 const saveInstruction=async()=>{
  const title=instructionDraft.title.trim();
  const text=instructionDraft.text.trim();
  const position=positions.find(item=>item.name===instructionDraft.position);

  if(!title||!text||!position)return;

  try{
   const response=await fetch(`${API_URL}/processes`,{
    method:"POST",
    headers:{
     "Content-Type":"application/json",
     ...getAuthHeaders()
    },
    body:JSON.stringify({
     name:title,
     position_id:position.id,
     goal:text
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось добавить инструкцию");
   }

   setInstructions(prev=>[...prev,data]);
   setAddingInstruction(false);
   setInstructionDraft({title:"",position:"",text:""});
  }catch(error){
   alert(error.message||"Не удалось добавить инструкцию");
  }
 };

 const startEditInstruction=item=>{
  setEditingInstruction(item.id);
  setAddingInstruction(false);
  setInstructionDraft({
   title:item.title,
   position:item.position,
   text:item.text
  });
 };

 const saveEditedInstruction=async()=>{
  const title=instructionDraft.title.trim();
  const text=instructionDraft.text.trim();
  const position=positions.find(item=>item.name===instructionDraft.position);

  if(!title||!text||!position||editingInstruction===null)return;

  try{
   const response=await fetch(`${API_URL}/processes/${editingInstruction}`,{
    method:"PUT",
    headers:{
     "Content-Type":"application/json",
     ...getAuthHeaders()
    },
    body:JSON.stringify({
     name:title,
     position_id:position.id,
     goal:text
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось изменить инструкцию");
   }

   setInstructions(prev=>prev.map(item=>item.id===editingInstruction?data:item));
   setEditingInstruction(null);
   setInstructionDraft({title:"",position:"",text:""});
  }catch(error){
   alert(error.message||"Не удалось изменить инструкцию");
  }
 };

 const deleteInstructionContent=async item=>{
  if(!item?.id||instructionActionLoading)return;

  if(!window.confirm(`Удалить инструкцию «${item.title}» вместе с процессом, Process JSON и связанными скриншотами? Действие необратимо.`))return;

  setInstructionActionError("");
  setInstructionActionNote("");
  setInstructionActionLoading(true);

  try{
   const response=await fetch(`${API_URL}/processes/${item.id}/instruction`,{
    method:"DELETE",
    headers:getAuthHeaders()
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось удалить инструкцию");
   }

   setInstructions(prev=>prev.filter(entry=>entry.id!==item.id));
   setSelectedInstruction(prev=>prev&&prev.id===item.id?null:prev);
   setSelectedTraineeInstruction(prev=>prev&&prev.id===item.id?null:prev);
   setLearnedInstructions(prev=>prev.filter(id=>id!==item.id));
   setOpenedTraineeInstructions(prev=>prev.filter(id=>id!==item.id));
   setTestResults(prev=>{
    const copy={...prev};
    delete copy[item.id];
    return copy;
   });
   setTestDetails(prev=>{
    const copy={...prev};
    delete copy[item.id];
    return copy;
   });
   setInstructionActionNote(data?.message||"Инструкция полностью удалена вместе с процессом");
  }catch(error){
   setInstructionActionError(error.message||"Не удалось удалить инструкцию");
  }finally{
   setInstructionActionLoading(false);
  }
 };

 const removeInstruction=async id=>{
  const item=instructions.find(x=>x.id===id);
  if(!item)return;
  await deleteInstructionContent(item);
 };

 const startEditInstructionText=item=>{
  setInstructionEditDraft(item?.instruction_text||"");
  setInstructionActionError("");
  setInstructionActionNote("");
  setInstructionEditing(true);
 };

 const cancelEditInstructionText=()=>{
  setInstructionEditing(false);
  setInstructionEditDraft("");
  setInstructionActionError("");
  setInstructionActionNote("");
 };

 const saveInstructionText=async item=>{
  if(!item?.id||instructionActionLoading)return;

  const text=instructionEditDraft.trim();

  if(!text){
   setInstructionActionError("Текст инструкции не может быть пустым");
   return;
  }

  if(!item.text){
   setInstructionActionError("У процесса не заполнено описание — обратитесь к руководителю");
   return;
  }

  setInstructionActionError("");
  setInstructionActionNote("");
  setInstructionActionLoading(true);

  try{
   const response=await fetch(`${API_URL}/processes/${item.id}`,{
    method:"PUT",
    headers:{
     "Content-Type":"application/json",
     ...getAuthHeaders()
    },
    body:JSON.stringify({
     name:item.title,
     position_id:item.position_id,
     goal:item.text,
     instruction_text:text
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось сохранить инструкцию");
   }

   setInstructions(prev=>prev.map(entry=>entry.id===item.id?data:entry));
   setSelectedInstruction(prev=>prev&&prev.id===item.id?data:prev);
   setInstructionEditing(false);
   setInstructionEditDraft("");
  }catch(error){
   setInstructionActionError(error.message||"Не удалось сохранить инструкцию");
  }finally{
   setInstructionActionLoading(false);
  }
 };

  const askQuestion=async rawQuestion=>{
   const question=String(rawQuestion||"").trim();
   if(!question||questionLoading)return;

   setQuestionChat(prev=>[...prev,{role:"user",content:question}]);
   setMessage("");
   setQuestionError("");
   setQuestionLoading(true);

   try{
    const response=await fetch(`${API_URL}/ai/question`,{
     method:"POST",
     headers:{
      "Content-Type":"application/json",
      ...getAuthHeaders()
     },
     body:JSON.stringify({question})
    });

    const data=await response.json().catch(()=>null);

    if(!response.ok){
     throw new Error(data?.detail||"Не удалось получить ответ");
    }

    setQuestionChat(prev=>[
     ...prev,
     {
      role:"assistant",
      content:data.answer||"",
      status:data.status||"answered",
      sources:Array.isArray(data.sources)?data.sources:[]
     }
    ]);
   }catch(error){
    setQuestionError(error.message||"Не удалось получить ответ");
   }finally{
    setQuestionLoading(false);
   }
  };

  const sendMessage=()=>{
   const value=message.trim();
   if(!value||questionTransitioning)return;

   if(active==="question"){
    askQuestion(value);
    return;
   }

   setMessage("");
  };

 const startInterview=async()=>{
  setInterviewOpen(true);
  setInterviewStep(1);
  setInterviewAnswer("");
  setInterviewHistory([]);
  setInterviewError("");
  setInterviewProcess(null);
  setInterviewScreenshot(null);
  setInterviewScreenshotRequest(false);
 setInterviewSavedNote("");
 setInterviewSavedProcessId(null);
 setInterviewInstructionError("");
 setInterviewInstructionLoading(false);
 setInterviewFinished(false);
 setInterviewSaveFailed(false);
 setInterviewAttachments([]);
 setInterviewPendingStep(null);
  setInterviewLoading(true);

  try{
   const response=await fetch(`${API_URL}/ai/interview`,{
    method:"POST",
    headers:{
     "Content-Type":"application/json",
     ...getAuthHeaders()
    },
    body:JSON.stringify({
     message:"",
     history:[],
     role:currentUser?.role||null,
     position:(positions.find(position=>Number(position.id)===Number(currentUser?.position_id))?.name||specialistPosition||null),
     process:null,
     attachments:[],
     screenshot_step:null,
     screenshot_name:null
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось запустить интервью");
   }

   setInterviewHistory([{role:"assistant",content:data.message||""}]);

   const initialStep=attachmentStepMarker(data.message);
   if(initialStep)setInterviewPendingStep(initialStep);

   if(data.status==="completed"){
    setInterviewProcess(data.process_json||null);
    saveInterviewProcess(data.process_json,[]);
    setInterviewFinished(true);
   }
  }catch(error){
   setInterviewError(error.message||"Не удалось запустить интервью");
  }finally{
   setInterviewLoading(false);
  }
 };

 const sendInterviewAnswer=async()=>{
  const answer=interviewAnswer.trim();
  if((!answer&&!interviewScreenshot)||interviewLoading)return;

  const nextHistory=[
   ...interviewHistory,
   ...(answer?[{role:"user",content:answer}]:[])
  ];

  setInterviewHistory(nextHistory);
  setInterviewAnswer("");
  setInterviewError("");
  setInterviewLoading(true);

  try{
   const response=await fetch(`${API_URL}/ai/interview`,{
    method:"POST",
    headers:{
     "Content-Type":"application/json",
     ...getAuthHeaders()
    },
    body:JSON.stringify({
     message:answer,
     history:nextHistory,
     role:currentUser?.role||null,
     position:specialistPosition||null,
     process:null,
     screenshot:interviewScreenshot?.data||null,
     screenshot_type:interviewScreenshot?.type||null,
     screenshot_name:interviewScreenshot?.name||null,
     screenshot_step:interviewPendingStep,
     attachments:interviewAttachments
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось получить ответ ИИ");
   }

   if(data.message){
    setInterviewHistory(prev=>[
     ...prev,
     {role:"assistant",content:data.message}
    ]);
   }

   const nextAttachments=data.stored_attachment
    ?[
      ...interviewAttachments.filter(item=>Number(item?.file_id)!==Number(data.stored_attachment.file_id)),
      data.stored_attachment
     ]
    :interviewAttachments;

   if(data.stored_attachment)setInterviewAttachments(nextAttachments);

   const requestedStep=attachmentStepMarker(data.message);
   if(requestedStep)setInterviewPendingStep(requestedStep);

   setInterviewScreenshot(null);
   setInterviewScreenshotRequest(
    data.screenshot_request===true&&
    !(requestedStep&&nextAttachments.some(item=>String(item?.step_id)===String(requestedStep)))
   );

   if(data.status==="completed"){
    setInterviewProcess(data.process_json||null);
    saveInterviewProcess(data.process_json,nextAttachments);
    setInterviewFinished(true);
   }

   setInterviewStep(prev=>prev+1);
  }catch(error){
   setInterviewError(error.message||"Не удалось получить ответ ИИ");
  }finally{
   setInterviewLoading(false);
  }
 };

 const generateInstructionForProcess=async(processJson,processId)=>{
  const response=await fetch(`${API_URL}/ai/instruction`,{
   method:"POST",
   headers:{
    "Content-Type":"application/json",
    ...getAuthHeaders()
   },
   body:JSON.stringify({
    process_json:processJson,
    process_id:processId
   })
  });

  const data=await response.json().catch(()=>null);

  if(!response.ok){
   throw new Error(data?.detail||"Не удалось сгенерировать инструкцию");
  }

  setInstructions(prev=>prev.map(item=>item.id===processId?{...item,instruction_text:data.instruction}:item));
  setSelectedInstruction(prev=>prev&&prev.id===processId?{...prev,instruction_text:data.instruction}:prev);

  return data;
 };

 const retryInstructionGeneration=async()=>{
  if(!interviewProcess||!interviewSavedProcessId||interviewInstructionLoading)return;

  setInterviewInstructionError("");
  setInterviewInstructionLoading(true);

  try{
   await generateInstructionForProcess(interviewProcess,interviewSavedProcessId);
   setInterviewSavedNote(prev=>prev?`${prev} Готовый текст инструкции сгенерирован.`:"Готовый текст инструкции сгенерирован.");
  }catch(error){
   setInterviewInstructionError(error.message||"Не удалось сгенерировать инструкцию");
  }finally{
   setInterviewInstructionLoading(false);
  }
 };

 const generateInstructionFromDetail=async item=>{
  if(!item?.process_json||!item?.id||instructionTextLoading)return;

  setInstructionTextError("");
  setInstructionActionNote("");
  setInstructionTextLoading(true);

  try{
   await generateInstructionForProcess(item.process_json,item.id);
  }catch(error){
   setInstructionTextError(error.message||"Не удалось сгенерировать инструкцию");
  }finally{
   setInstructionTextLoading(false);
  }
 };

 const saveInterviewProcess=async(processJson,attachmentsOverride)=>{
  if(!processJson)return;

  setInterviewSavedNote("");
  setInterviewSaveFailed(false);

  const knownAttachments=Array.isArray(attachmentsOverride)?attachmentsOverride:interviewAttachments;
  const processJsonForSave=mergeStoredAttachments(
   sanitizeProcessJsonAttachments(processJson,knownAttachments),
   knownAttachments
  );

  setInterviewProcess(processJsonForSave);

  const position=positions.find(
   item=>Number(item.id)===Number(currentUser?.position_id)
  );
  const name=String(processJsonForSave?.metadata?.process||"").trim();
  const goal=String(processJsonForSave?.goal||"").trim();

  if(!position?.id){
   setInterviewError("Не удалось определить должность интервью — результат не сохранён.");
   setInterviewSaveFailed(true);
   return;
  }

  if(!name||!goal){
   setInterviewError("Process JSON не содержит названия процесса или цели — результат не сохранён.");
   setInterviewSaveFailed(true);
   return;
  }

  try{
   const response=await fetch(`${API_URL}/processes`,{
    method:"POST",
    headers:{
     "Content-Type":"application/json",
     ...getAuthHeaders()
    },
    body:JSON.stringify({
     name,
     position_id:position.id,
     goal,
     process_json:processJsonForSave
    })
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Не удалось сохранить результат интервью");
   }

   setInstructions(prev=>prev.some(item=>item.id===data.id)?prev:[...prev,data]);
   setInterviewSavedNote(`Результат интервью сохранён как инструкция «${data.title}» (должность: ${data.position}).`);
   setInterviewSavedProcessId(data.id);

   setInterviewInstructionLoading(true);

   try{
    await generateInstructionForProcess(processJsonForSave,data.id);
    setInterviewSavedNote(`Инструкция «${data.title}» сохранена, готовый текст сгенерирован (должность: ${data.position}).`);
   }catch(genError){
    setInterviewInstructionError(genError.message||"Не удалось сгенерировать инструкцию");
   }finally{
    setInterviewInstructionLoading(false);
   }
  }catch(error){
   setInterviewError(error.message||"Не удалось сохранить результат интервью");
   setInterviewSaveFailed(true);
  }
 };

 const handleInterviewScreenshot=event=>{
  const file=event.target.files?.[0];
  if(!file)return;

  if(!["image/png","image/jpeg","image/webp"].includes(file.type)){
   setInterviewError("Можно прикрепить PNG, JPG или WebP");
   event.target.value="";
   return;
  }

  if(file.size>8*1024*1024){
   setInterviewError("Размер скриншота не должен превышать 8 МБ");
   event.target.value="";
   return;
  }

  const reader=new FileReader();

  reader.onload=()=>{
   setInterviewScreenshot({
    name:file.name,
    type:file.type,
    data:String(reader.result).replace(/^data:image\/[^;]+;base64,/,"")
   });
   setInterviewError("");
  };

  reader.onerror=()=>{
   setInterviewError("Не удалось прочитать скриншот");
  };

  reader.readAsDataURL(file);
 };

 const handleLogin=async()=>{
  const username=login.trim();

  if(!username||!password){
   setLoginError("Введите логин и пароль");
   return;
  }

  try{
   setLoginError("");

   const body=new URLSearchParams();
   body.append("username",username);
   body.append("password",password);

   const response=await fetch(`${API_URL}/auth/login`,{
    method:"POST",
    headers:{
     "Content-Type":"application/x-www-form-urlencoded"
    },
    body:body.toString()
   });

   const data=await response.json().catch(()=>null);

   if(!response.ok){
    throw new Error(data?.detail||"Неверный логин или пароль");
   }

   localStorage.setItem("ortona_access_token",data.access_token);
   localStorage.setItem("ortona_user",JSON.stringify(data.user));

   setCurrentUser(data.user);
   setAuthenticated(true);
   const initialView=getInitialView(data.user.role);
   setActive(initialView.active);
   setSection(initialView.section);
   setLoginError("");
   setPassword("");
  }catch(error){
   const message=error instanceof TypeError
    ? "Не удалось подключиться к локальному серверу. Проверьте, что backend запущен на порту 8000."
    : error.message;
   setLoginError(message||"Не удалось выполнить вход");
  }
 };

 const handleLogout=()=>{
  localStorage.removeItem("ortona_access_token");
  localStorage.removeItem("ortona_user");
  setCurrentUser(null);
  setAuthenticated(false);
  setActive("manager");
  setSection("home");
 };

 const specialistInstructions=instructions.filter(item=>{
  const matchesPosition=!specialistPosition||item.position===specialistPosition;
  const q=instructionSearch.trim().toLowerCase();
  const matchesSearch=!q||
   item.title.toLowerCase().includes(q)||
   item.text.toLowerCase().includes(q);
  return matchesPosition&&matchesSearch;
 });

 const testTotal=testQuestions.length;
 const testPercent=testTotal?Math.round((testScore/testTotal)*100):0;
 const testPassed=testPercent>=testPassPercent;
 const testRequiredCorrect=testTotal?Math.ceil(testTotal*testPassPercent/100):0;

 const learnedIds=new Set(learnedInstructions);
 const completedInstructions=[];

 instructions.forEach(item=>{
  const percent=testResults[item.id];

  if(learnedIds.has(item.id)||(percent!==undefined&&percent>=testPassPercent)){
   completedInstructions.push(item.id);
  }
 });

 const testBadgeTitle=id=>{
  const details=testDetails[id];

  if(!details)return "";

  return `${details.score} из ${details.total}`+
   (details.attempts?`, попыток: ${details.attempts}`:"")+
   (details.lastAt?`, ${formatDateTime(details.lastAt)}`:"");
 };

 if(!authenticated){
  return <div className="login-page">
   <style>{`
    @media (max-width:700px){
     .login-page{min-height:100svh;height:auto;overflow-y:auto;padding:14px 12px 20px;box-sizing:border-box;}
     .login-brand{position:relative;top:auto;left:auto;width:100%;margin:0 auto 6px;padding:0;justify-content:center;}
     .login-content{width:100%;max-width:420px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:6px;}
     .login-robot-wrap{width:100%;height:110px;display:flex;align-items:flex-end;justify-content:center;overflow:visible;margin:0;}
     .login-robot{display:block;max-width:155px;max-height:105px;width:auto;height:auto;object-fit:contain;}
     .login-card{width:100%;max-width:420px;margin:0;box-sizing:border-box;}
     .login-card-logo{display:none;}
     .login-card-heading{margin-top:0;}
     .login-footer{display:none;}
    }
   `}</style>
   <div className="login-glow login-glow-one"></div>
   <div className="login-glow login-glow-two"></div>

   <div className="login-brand">
    <img src="./ortho-n-logo.png" alt="ORTO-N"/>
    <div>
     <strong>Ортона-AI</strong>
     <span>Система обучения сотрудников</span>
    </div>
   </div>

   <div className="login-content">
    <div className="login-robot-wrap">
     <img className="login-robot" src="./ortona-login-robot.png" alt="Ортона-AI"/>
    </div>

    <div className="login-card">
     <div className="login-card-logo">
      <img src="./ortho-n-logo.png" alt="ORTO-N"/>
     </div>

     <div className="login-card-heading">
      <span>ДОБРО ПОЖАЛОВАТЬ</span>
      <h1>Вход в систему</h1>
      <p>Введите данные для доступа к Ортона-AI</p>
     </div>

     <label className="login-field">
      <span>Логин</span>
      <input type="text" value={login}
       onChange={e=>{setLogin(e.target.value);setLoginError("");}}
       onKeyDown={e=>e.key==="Enter"&&handleLogin()}
       placeholder="Введите логин" autoComplete="username"/>
     </label>

     <label className="login-field">
      <span>Пароль</span>
      <div className="login-password">
       <input type={showPassword?"text":"password"} value={password}
        onChange={e=>{setPassword(e.target.value);setLoginError("");}}
        onKeyDown={e=>e.key==="Enter"&&handleLogin()}
        placeholder="Введите пароль" autoComplete="current-password"/>
       <button type="button" onClick={()=>setShowPassword(!showPassword)}>
        {showPassword?"Скрыть":"Показать"}
       </button>
      </div>
     </label>

     {loginError&&<div className="login-error">{loginError}</div>}

     <button className="login-submit" onClick={handleLogin}>
      Войти
      <ArrowLeft size={19} style={{transform:"rotate(180deg)"}}/>
     </button>
    </div>
   </div>

   <div className="login-footer">
    <span>ОРТО-N</span>
    <span>ЗАБОТА • ТЕХНОЛОГИИ • РЕЗУЛЬТАТ</span>
   </div>
  </div>;
 }

 return <div className="app">
 <style>{`
  .agent-title{display:flex;align-items:center;justify-content:center;gap:12px;}
  .profile-data{display:flex;flex-direction:column;min-width:0;}
  .profile-data strong,.profile-data span{display:block;}
  .logout-button{border:1px solid rgba(255,255,255,.65);background:rgba(255,255,255,.18);color:#fff;border-radius:12px;padding:10px 15px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.10);}
  .logout-button:hover{background:rgba(255,255,255,.30);}
  .logo-wrap,.sidebar-bottom{display:flex;align-items:center;}
  .logo-wrap img,.sidebar-bottom img{background:rgba(255,255,255,.88);border-radius:14px;padding:5px 9px;box-sizing:border-box;box-shadow:0 4px 14px rgba(0,0,0,.16);}
  .user-list-data{display:flex;flex-direction:column;gap:4px;min-width:0;}
  .user-list-data strong,.user-list-data span{display:block;}
  .user-list-data span{font-size:.9em;opacity:.72;}
  .user-row-main{gap:14px;}
  .user-list-data{gap:5px;}
  .user-full-name{line-height:1.2;}
  .user-login{line-height:1.2;padding:3px 8px;border:1px solid rgba(0,120,140,.16);border-radius:7px;background:rgba(0,170,180,.06);width:max-content;max-width:100%;}
  .user-login b{font-weight:700;opacity:1;}
  @media (max-width:700px){
   .layout{display:block;}
   .sidebar{width:100%;height:auto;min-height:0;position:relative;padding:10px 10px 8px;box-sizing:border-box;}
   .sidebar h2{margin:4px 8px 8px;}
   .sidebar nav{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
   .menu-item{min-height:52px;padding:10px 12px;}
   .sidebar-bottom{display:none;}
   .workspace{width:100%;min-width:0;box-sizing:border-box;overflow:visible;}
   .question-page{min-height:320px;padding:20px 14px 30px;box-sizing:border-box;overflow:visible;}
   .question-hero{position:relative;z-index:1;min-height:250px;}
   .question-robot{max-width:190px;height:auto;}
   .composer-area{position:relative;z-index:5;padding:0 12px 12px;}
   .topbar{flex-wrap:wrap;height:auto;min-height:90px;padding:10px 12px;gap:8px;}
   .brand-placeholder{display:none;}
   .agent-title{order:1;flex:1;justify-content:flex-start;}
   .topbar-right{order:2;display:flex;gap:6px;align-items:center;}
   .profile{padding:5px 7px;}
   .profile-data strong{max-width:145px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
   .logout-button{padding:8px 10px;font-size:13px;}
  }
 `}</style>

  <header className="topbar">
   <div className="brand-placeholder">
    <div>СОВРЕМЕННЫЕ РЕШЕНИЯ</div>
    <div>ДЛЯ АКТИВНОЙ ЖИЗНИ</div>
   </div>

   <div className="agent-title">
    <strong>Ортона-AI</strong>
    <span>Менеджер по обучению</span>
   </div>

   <div className="topbar-right">

    <div className="profile">
    <div className="avatar">
     {(currentUser?.username||"П").charAt(0).toUpperCase()}
    </div>
    <div className="profile-data">
     <strong>{currentUser?.full_name||currentUser?.username||"Пользователь"}</strong>
     <span>
      {currentUser?.role==="manager"
       ?"Руководитель"
       :currentUser?.role==="specialist"
        ?"Специалист"
        :"Стажер"}
     </span>
    </div>
    <ChevronDown size={17}/>
   </div>

   <button className="logout-button" onClick={handleLogout} title="Выйти из приложения">
    Выйти
   </button>

   </div>
  </header>

  <div className="layout">

   <aside className="sidebar">
    <h2>МЕНЮ</h2>

    <nav>
     {menu.filter(item=>item.roles.includes(currentUser?.role)).map(({key,label,icon:Icon})=>
      <button
       key={key}
       className={`menu-item ${active===key?"active":""}`}
       onClick={()=>selectMenu(key)}
      >
       <Icon size={23} strokeWidth={1.9}/>
       <span>{label}</span>
       <ChevronRight className="menu-arrow" size={20}/>
      </button>
     )}
    </nav>

    <div className="sidebar-bottom">
     <img src="./ortho-n-logo.png" alt="ORTO-N"/>
     <div className="sidebar-slogan">
      ЗАБОТА<br/>
      ТЕХНОЛОГИИ<br/>
      РЕЗУЛЬТАТ
     </div>
    </div>
   </aside>

   <main className="workspace">

    {active==="manager"&&section==="home"&&
     <section className="manager-home">
      <div className="section-heading">
       <h2>Руководитель</h2>
       <p>Управление должностями и инструкциями клиники</p>
      </div>

      <div className="manager-grid">
       <button className="manager-card" onClick={openPositions}>
        <div className="card-icon">
         <BriefcaseBusiness size={25}/>
        </div>
        <strong>Должности</strong>
        <span>Добавление, редактирование и удаление должностей сотрудников.</span>
       </button>

       <button className="manager-card" onClick={openInstructions}>
        <div className="card-icon">
         <FileText size={25}/>
        </div>
        <strong>Инструкции</strong>
        <span>Создание и управление инструкциями, привязанными к должностям.</span>
       </button>

       <button className="manager-card" onClick={openUsers}>
        <div className="card-icon">
         <Users size={25}/>
        </div>
        <strong>Пользователи</strong>
        <span>Создание сотрудников и назначение им роли и пароля.</span>
       </button>

       <button className="manager-card" onClick={openTestResults}>
        <div className="card-icon">
         <ClipboardList size={25}/>
        </div>
        <strong>Результаты тестов</strong>
        <span>Журнал попыток тестирования сотрудников с фильтрами.</span>
       </button>
      </div>
     </section>
    }

    {active==="manager"&&section==="positions"&&
     <section className="manager-subpage">
      <button className="back-link" onClick={()=>setSection("home")}>
       <ArrowLeft size={17}/>
       Назад к разделу «Руководитель»
      </button>

      <div className="section-heading">
       <h2>Должности</h2>
       <p>Управление должностями сотрудников клиники</p>
      </div>

      <div className="positions-panel">
       <div className="positions-header">
        <h3>Список должностей</h3>
        <button className="add-position" onClick={addPosition}>
         <Plus size={18}/>
         Добавить должность
        </button>
       </div>

       {addingPosition&&
        <div className="position-row editing-row">
         <input autoFocus value={positionDraft}
          onChange={e=>setPositionDraft(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&saveNewPosition()}
          placeholder="Название должности"/>
         <button onClick={saveNewPosition}><Check size={19}/></button>
         <button onClick={()=>setAddingPosition(false)}><X size={19}/></button>
        </div>
       }

       {positions.map((position,index)=>
        <div className="position-row" key={position.id}>
         {editingPosition===index?
          <>
           <input autoFocus value={positionDraft}
            onChange={e=>setPositionDraft(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&savePosition()}/>
           <button onClick={savePosition}><Check size={19}/></button>
           <button onClick={()=>setEditingPosition(null)}><X size={19}/></button>
          </>
          :
          <>
           <div className="position-name">
            <BriefcaseBusiness size={19}/>
            <span>{position.name}</span>
           </div>
           <div className="position-actions">
            <button onClick={()=>startEditPosition(index)}><Pencil size={18}/></button>
            <button className="delete-btn" onClick={()=>removePosition(index)}><Trash2 size={18}/></button>
           </div>
          </>
         }
        </div>
       )}

       {!positions.length&&
        <div className="empty-positions">Должностей пока нет.</div>
       }
      </div>
     </section>
    }

    {active==="manager"&&section==="instructions"&&
     <section className="manager-subpage">
      <button className="back-link" onClick={()=>setSection("home")}>
       <ArrowLeft size={17}/>
       Назад к разделу «Руководитель»
      </button>

      <div className="section-heading">
       <h2>Инструкции</h2>
       <p>Инструкции сотрудников, привязанные к должностям</p>
      </div>

      <div className="positions-panel">
       <div className="positions-header">
        <h3>Список инструкций</h3>
        <button className="add-position" onClick={startAddInstruction}>
         <Plus size={18}/>
         Добавить инструкцию
        </button>
       </div>

       {(addingInstruction||editingInstruction!==null)&&
        <div className="instruction-editor">
         <input value={instructionDraft.title}
          onChange={e=>setInstructionDraft({...instructionDraft,title:e.target.value})}
          placeholder="Название инструкции"/>

         <select value={instructionDraft.position}
          onChange={e=>setInstructionDraft({...instructionDraft,position:e.target.value})}>
          <option value="">Выберите должность</option>
          {positions.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
         </select>

         <textarea value={instructionDraft.text}
          onChange={e=>setInstructionDraft({...instructionDraft,text:e.target.value})}
          placeholder="Текст инструкции"/>

         <div className="instruction-editor-actions">
          <button className="add-position"
           onClick={editingInstruction!==null?saveEditedInstruction:saveInstruction}>
           <Check size={18}/>
           Сохранить
          </button>

          <button className="cancel-btn"
           onClick={()=>{
            setAddingInstruction(false);
            setEditingInstruction(null);
           }}>
           <X size={18}/>
           Отмена
          </button>
         </div>
        </div>
       }

       {instructionActionNote&&
        <div className="interview-instruction-status">{instructionActionNote}</div>
       }

       {instructions.map(item=>
        <div className="instruction-row" key={item.id}>
         <div className="instruction-info">
          <FileText size={21}/>
          <div>
           <strong>{item.title}</strong>
           <span>{item.position}</span>
           <p>{item.text}</p>
          </div>
         </div>

         <div className="position-actions">
          <button onClick={()=>startEditInstruction(item)}><Pencil size={18}/></button>
          <button className="delete-btn" onClick={()=>removeInstruction(item.id)}><Trash2 size={18}/></button>
         </div>
        </div>
       )}

       {!instructions.length&&
        <div className="empty-positions">Инструкций пока нет.</div>
       }
      </div>
     </section>
    }

    {active==="manager"&&section==="users"&&currentUser?.role==="manager"&&
     <section className="manager-subpage">
      <button className="back-link" onClick={()=>setSection("home")}>
       <ArrowLeft size={17}/>
       Назад к разделу «Руководитель»
      </button>

      <div className="section-heading">
       <h2>Пользователи</h2>
       <p>Управление учётными записями сотрудников</p>
      </div>

      <div className="positions-panel">
       <div className="positions-header">
        <h3>Список пользователей</h3>
        <button className="add-position" onClick={()=>{setAddingUser(true);setEditingUser(null);setUserError("");}}>
         <Plus size={18}/>
         Добавить пользователя
        </button>
       </div>

       {addingUser&&
        <div className="instruction-editor">
         <input
          autoFocus
          value={userDraft.full_name}
          onChange={e=>setUserDraft({...userDraft,full_name:e.target.value})}
          placeholder="ФИО сотрудника"
          autoComplete="name"
         />

         <input
          value={userDraft.username}
          onChange={e=>setUserDraft({...userDraft,username:e.target.value})}
          placeholder="Логин"
          autoComplete="off"
         />

         <input
          type="password"
          value={userDraft.password}
          onChange={e=>setUserDraft({...userDraft,password:e.target.value})}
          placeholder="Пароль (минимум 6 символов)"
          autoComplete="new-password"
         />

         <select
          value={userDraft.role}
          onChange={e=>setUserDraft({...userDraft,role:e.target.value})}
         >
          <option value="specialist">Специалист</option>
          <option value="trainee">Стажер</option>
         </select>

         {userDraft.role!=="manager"&&
          <select
           value={userDraft.position_id||""}
           onChange={e=>setUserDraft({
            ...userDraft,
            position_id:e.target.value?Number(e.target.value):null
           })}
          >
           <option value="">Выберите должность</option>
           {positions.map(position=>(
            <option key={position.id} value={position.id}>{position.name}</option>
           ))}
          </select>
         }

         <div className="instruction-editor-actions">
          <button className="add-position" onClick={saveNewUser}>
           <Check size={18}/>
           Создать
          </button>
          <button className="cancel-btn" onClick={()=>setAddingUser(false)}>
           <X size={18}/>
           Отмена
          </button>
         </div>
       </div>
       }

       {editingUser!==null&&
        <div className="instruction-editor">
         <input
          autoFocus
          value={userEditDraft.full_name}
          onChange={e=>setUserEditDraft({...userEditDraft,full_name:e.target.value})}
          placeholder="ФИО сотрудника"
          autoComplete="name"
         />

         <select
          value={userEditDraft.role}
          onChange={e=>setUserEditDraft({...userEditDraft,role:e.target.value})}
         >
          <option value="manager">Руководитель</option>
          <option value="specialist">Специалист</option>
          <option value="trainee">Стажер</option>
         </select>

         {userEditDraft.role!=="manager"&&
          <select
           value={userEditDraft.position_id||""}
           onChange={e=>setUserEditDraft({
            ...userEditDraft,
            position_id:e.target.value?Number(e.target.value):null
           })}
          >
           <option value="">Выберите должность</option>
           {positions.map(position=>(
            <option key={position.id} value={position.id}>{position.name}</option>
           ))}
          </select>
         }

         <div className="instruction-editor-actions">
          <button className="add-position" onClick={saveEditedUser}>
           <Check size={18}/>
           Сохранить изменения
          </button>
          <button className="cancel-btn" onClick={()=>setEditingUser(null)}>
           <X size={18}/>
           Отмена
          </button>
         </div>
        </div>
       }

       {userError&&<div className="login-error">{userError}</div>}

       {usersLoading&&
        <div className="empty-positions">Загрузка пользователей...</div>
       }

       {!usersLoading&&users.map(user=>
        <div className="position-row" key={user.id}>
         <div className="position-name user-row-main">
          <Users size={19}/>
          <div className="user-list-data">
           <strong className="user-full-name">{user.full_name||user.username}</strong>
           <span className="user-login">Логин: <b>{user.username}</b></span>
          </div>
         </div>
         <div className="position-actions" style={{gap:16}}>
          <span>{user.role==="manager"?"Руководитель":user.role==="specialist"?"Специалист":"Стажер"}</span>
          <span>{user.is_active?"Активен":"Отключён"}</span>
          <button title="Редактировать пользователя" onClick={()=>startEditUser(user)}><Pencil size={18}/></button>
          <button
           className="delete-btn"
           title={user.id===currentUser?.id?"Нельзя удалить собственную учётную запись":"Удалить пользователя"}
           disabled={user.id===currentUser?.id}
           onClick={()=>removeUser(user)}
          ><Trash2 size={18}/></button>
         </div>
        </div>
       )}

       {!usersLoading&&!users.length&&
        <div className="empty-positions">Пользователей пока нет.</div>
       }
      </div>
     </section>
    }

    {active==="manager"&&section==="test-results"&&currentUser?.role==="manager"&&
     <section className="manager-subpage">
      <button className="back-link" onClick={()=>setSection("home")}>
       <ArrowLeft size={17}/>
       Назад к разделу «Руководитель»
      </button>

      <div className="section-heading">
       <h2>Результаты тестирования</h2>
       <p>Журнал всех попыток тестирования сотрудников</p>
      </div>

      <div className="results-filters">
       <label>
        <span>Сотрудник</span>
        <select value={managerResultsUser} onChange={e=>changeManagerResultUser(e.target.value)}>
         <option value="">Все сотрудники</option>
         {users.map(user=>
          <option key={user.id} value={user.id}>{user.full_name||user.username}</option>
         )}
        </select>
       </label>

       <label>
        <span>Должность</span>
        <select value={managerResultsPosition} onChange={e=>changeManagerResultPosition(e.target.value)}>
         <option value="">Все должности</option>
         {positions.map(position=>
          <option key={position.id} value={position.id}>{position.name}</option>
         )}
        </select>
       </label>
      </div>

      <div className="positions-panel">
       <div className="positions-header">
        <h3>Попытки тестирования</h3>
        <span className="results-count">{managerResults.length}</span>
       </div>

       {managerResultsLoading&&
        <div className="empty-positions">Загрузка результатов...</div>
       }

       {!managerResultsLoading&&managerResultsError&&
        <div className="login-error">{managerResultsError}</div>
       }

       {!managerResultsLoading&&!managerResultsError&&managerResults.map(row=>
        <div className="results-row" key={row.id}>
         <div className="results-people">
          <strong>{row.full_name||row.username}</strong>
          <span>{row.position_name}</span>
         </div>

         <div className="results-process">{row.process_name}</div>

         <div className="results-score">
          <strong>{row.percent}%</strong>
          <span>{row.score} из {row.total}</span>
         </div>

         <div className={`results-status ${row.passed?"passed":"failed"}`}>
          {row.passed?"Пройден":"Не пройден"}
         </div>

         <div className="results-date">{formatDateTime(row.created_at)}</div>
        </div>
       )}

       {!managerResultsLoading&&!managerResultsError&&!managerResults.length&&
        <div className="empty-positions">Результатов тестирования пока нет.</div>
       }
      </div>
     </section>
    }

    {active==="specialist"&&
     <section className="specialist-page">

      {!selectedInstruction?
       <>
        <div className="section-heading">
         <h2>Специалист</h2>
         <p>Обучение и рабочие инструкции по вашей должности</p>
        </div>

        <div className="specialist-toolbar">
         <div className="specialist-position-select">
          <label>Ваша должность</label>
          <select
           value={specialistPosition}
           onChange={e=>setSpecialistPosition(e.target.value)}
          >
           <option value="">Все должности</option>
           {positions.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
         </div>

         <div className="specialist-search">
          <Search size={19}/>
          <input
           value={instructionSearch}
           onChange={e=>setInstructionSearch(e.target.value)}
           placeholder="Поиск по инструкциям..."
          />
         </div>
        </div>


        <div className="interview-launch">
         <div className="interview-launch-icon"><BriefcaseBusiness size={25}/></div>
         <div className="interview-launch-content">
          <h3>Интервью</h3>
          <p>Проверьте знания и готовность к работе по вашей должности.</p>
         </div>
         <button className="interview-launch-button" onClick={startInterview}>
          Начать интервью
          <ChevronRight size={19}/>
         </button>
        </div>

        <div className="specialist-list">
         <div className="specialist-list-header">
          <h3>Доступные инструкции</h3>
          <span>{specialistInstructions.length}</span>
         </div>

         {specialistInstructions.map(item=>
          <button
           className="specialist-instruction"
           key={item.id}
           onClick={()=>{ setOpenedTraineeInstructions(prev=>prev.includes(item.id)?prev:[...prev,item.id]); setSelectedInstruction(item);}}
          >
           <div className="specialist-instruction-icon">
            <FileText size={22}/>
           </div>
           <div>
            <strong>{item.title}</strong>
            <span>{item.position}</span>
            <p>{item.text}</p>
           </div>
           <ChevronRight size={20}/>
          </button>
         )}

         {!specialistInstructions.length&&
          <div className="empty-positions">По выбранным параметрам инструкций не найдено.</div>
         }
        </div>
       </>
       :
       <div className="specialist-document">
        <button className="back-link" onClick={()=>setSelectedInstruction(null)}>
         <ArrowLeft size={17}/>
         Назад к инструкциям
        </button>

        <div className="specialist-document-card">
         <div className="specialist-document-icon">
          <FileText size={27}/>
         </div>

         <div className="specialist-document-meta">
          <span>{selectedInstruction.position}</span>
          <h2>{selectedInstruction.title}</h2>
         </div>

        <div className="specialist-document-text">
         {selectedInstruction.text}
        </div>

        {selectedInstruction.instruction_text&&
         <div className="specialist-document-instruction">
          <span className="specialist-document-instruction-label">Готовая инструкция</span>
          <div className="instruction-generated-text">{selectedInstruction.instruction_text}</div>
         </div>
        }

        {renderProcessSteps(selectedInstruction.process_json)}

        {(currentUser?.role==="manager"||currentUser?.role==="specialist")&&selectedInstruction.process_json&&
         <div className="specialist-document-generate">
          <button
           className="interview-instruction-retry"
           disabled={instructionTextLoading}
           onClick={()=>generateInstructionFromDetail(selectedInstruction)}
          >
           {instructionTextLoading
            ?"Ортона-AI формирует текст инструкции..."
            :(selectedInstruction.instruction_text?"Сгенерировать инструкцию заново":"Сгенерировать готовую инструкцию")}
          </button>

          {instructionTextError&&<div className="login-error">{instructionTextError}</div>}
         </div>
        }

        {(currentUser?.role==="manager"||currentUser?.role==="specialist")&&
         <div className="instruction-actions">
          {instructionEditing?
           <>
            <textarea
             className="instruction-edit-textarea"
             value={instructionEditDraft}
             onChange={e=>setInstructionEditDraft(e.target.value)}
             placeholder="Текст готовой инструкции"
             rows={12}
            />

            <div className="instruction-actions-row">
             <button
              className="interview-instruction-retry"
              disabled={instructionActionLoading}
              onClick={()=>saveInstructionText(selectedInstruction)}
             >
              {instructionActionLoading?"Сохранение...":"Сохранить инструкцию"}
             </button>
             <button
              className="instruction-cancel-btn"
              disabled={instructionActionLoading}
              onClick={cancelEditInstructionText}
             >
              Отмена
             </button>
            </div>
           </>
           :
           <div className="instruction-actions-row">
            <button className="instruction-edit-btn" onClick={()=>startEditInstructionText(selectedInstruction)}>
             <Pencil size={17}/>
             Редактировать инструкцию
            </button>
            <button className="delete-btn" onClick={()=>deleteInstructionContent(selectedInstruction)}>
             <Trash2 size={18}/>
             Удалить инструкцию
            </button>
           </div>
          }

          {instructionActionError&&<div className="login-error">{instructionActionError}</div>}
          {instructionActionNote&&<div className="interview-instruction-status">{instructionActionNote}</div>}
         </div>
        }
       </div>
       </div>
      }
     </section>
    }

    {active==="trainee"&&
     <section className="trainee-page">
      <div className="section-heading">
       <h2>Стажер</h2>
       <p>Ваш путь обучения и инструкции для освоения должности</p>
      </div>

      <div className="trainee-position-card">
       <div>
        <label>Ваша должность</label>
        <select value={traineePosition} onChange={e=>setTraineePosition(e.target.value)}>
         <option value="">Выберите должность</option>
         {positions.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
       </div>

       <div className="trainee-progress">
        <span>Прогресс обучения</span>
        <strong>
         {traineePosition
          ? `${instructions.filter(i=>i.position===traineePosition&&completedInstructions.includes(i.id)).length} из ${instructions.filter(i=>i.position===traineePosition).length}`
          : "—"}
        </strong>
       </div>
      </div>

      {traineeError&&<div className="login-error">{traineeError}</div>}

      {!traineePosition&&
       <div className="trainee-empty">
        <GraduationCap size={42}/>
        <strong>Начните обучение</strong>
        <span>Выберите свою должность, чтобы увидеть программу обучения.</span>
       </div>
      }

      {traineePosition&&
       <div className="trainee-list">
        <div className="trainee-list-header">
         <h3>Программа обучения</h3>
         <span>{instructions.filter(i=>i.position===traineePosition).length}</span>
        </div>

        {instructions.filter(i=>i.position===traineePosition).map((item,index)=>{
         const done=completedInstructions.includes(item.id);
         const learned=learnedInstructions.includes(item.id);

         return <div className={`trainee-item ${done?"completed":""}`} key={item.id}>
          <div className="trainee-number">
           {done?<Check size={19}/>:index+1}
          </div>

          <div
           className="trainee-item-info trainee-instruction-open"
           onClick={()=>setSelectedTraineeInstruction(item)}
          >
           <strong>{item.title}</strong>
           <p>{item.text}</p>
           <span className="trainee-open-hint">Открыть инструкцию →</span>
          </div>

          <div className="trainee-item-actions">
           {testResults[item.id] !== undefined ? (
            testResults[item.id] === 100 ? (
             <button
              className="trainee-test-btn trainee-test-result trainee-test-result-perfect"
              title={testBadgeTitle(item.id)}
              disabled
             >
              <Check size={18}/>
              100%
             </button>
            ) : testResults[item.id] >= testPassPercent ? (
             <button
              className="trainee-test-btn trainee-test-result trainee-test-result-passed"
              title={testBadgeTitle(item.id)}
              disabled
             >
              <Check size={18}/>
              {testResults[item.id]}%
             </button>
            ) : (
             <button
              className="trainee-test-btn trainee-test-result trainee-test-result-failed"
              title={testBadgeTitle(item.id)}
              disabled={testLoading}
              onClick={()=>startTest(item)}
             >
              <X size={18}/>
              Попробуйте ещё раз
             </button>
            )
           ) : (
            <button
             className="trainee-test-btn"
             disabled={!done||testLoading}
             title={done?"":"Сначала изучите инструкцию, затем пройдите тестирование"}
             onClick={()=>startTest(item)}
            >
             {testLoading&&testingInstruction?.id===item.id?"Формируем тест…":"Пройти тестирование"}
            </button>
           )}

           <button
            disabled={(!openedTraineeInstructions.includes(item.id) && !done)||learnedSavingId===item.id}
            onClick={()=>toggleLearned(item)}
           >
            {learnedSavingId===item.id?"Сохранение…":(learned?"✓ Изучено":"Отметить изученным")}
           </button>
          </div>
         </div>
        })}

        {!instructions.some(i=>i.position===traineePosition)&&
         <div className="empty-positions">
          Для этой должности пока нет инструкций.
         </div>
        }
       </div>
      }
     </section>
    }
        {selectedTraineeInstruction&&
     <div
      className="trainee-instruction-modal-overlay"
      onClick={closeTraineeInstruction}
     >
      <div
       className="trainee-instruction-modal"
       onClick={e=>e.stopPropagation()}
      >
       <div className="trainee-instruction-modal-header">
        <div>
         <span>{selectedTraineeInstruction.position}</span>
         <h2>{selectedTraineeInstruction.title}</h2>
        </div>

        <button
         className="trainee-instruction-close"
         onClick={closeTraineeInstruction}
         aria-label="Закрыть"
        >
         ×
        </button>
       </div>

       <div className="trainee-instruction-modal-body">
        <div className="trainee-instruction-modal-icon">
         <FileText size={28}/>
        </div>

        <div className="trainee-instruction-fulltext">
         {selectedTraineeInstruction.text}
        </div>

        {selectedTraineeInstruction.instruction_text&&
         <div className="trainee-instruction-generated">
          <span className="specialist-document-instruction-label">Готовая инструкция</span>
          <div className="instruction-generated-text">{selectedTraineeInstruction.instruction_text}</div>
         </div>
        }

        {renderProcessSteps(selectedTraineeInstruction.process_json)}
       </div>

       <div className="trainee-instruction-modal-footer">
        <span>Ознакомьтесь с инструкцией полностью, затем закройте окно.</span>

        <button
         className="trainee-instruction-close-btn"
         onClick={closeTraineeInstruction}
        >
         Закрыть инструкцию
        </button>
       </div>
      </div>
     </div>
    }

    {testingInstruction&&
         <div className="test-modal-overlay" onClick={closeTest}>
          <div className="test-modal" onClick={e=>e.stopPropagation()}>

           {testLoading?
            <>
             <div className="test-modal-header">
              <div>
               <span>Тестирование</span>
               <h3>{testingInstruction.title}</h3>
              </div>
              <button className="test-modal-close" onClick={closeTest}>
               <X size={21}/>
              </button>
             </div>

             <div className="test-status">
              <span className="test-status-note">Формируем тест по Process JSON этой инструкции…</span>
             </div>
            </>
            :testError?
            <>
             <div className="test-modal-header">
              <div>
               <span>Тестирование</span>
               <h3>{testingInstruction.title}</h3>
              </div>
              <button className="test-modal-close" onClick={closeTest}>
               <X size={21}/>
              </button>
             </div>

             <div className="test-status">
              <div className="test-error-note">{testError}</div>
             </div>

             <div className="test-modal-footer">
              <button className="test-cancel-btn" onClick={closeTest}>
               Закрыть
              </button>
              <button
               className="test-next-btn"
               onClick={()=>startTest(testingInstruction)}
              >
               Попробовать снова
              </button>
             </div>
            </>
            :!testFinished?
            <>
             <div className="test-modal-header">
              <div>
               <span>Тестирование</span>
               <h3>{testingInstruction.title}</h3>
              </div>
              <button className="test-modal-close" onClick={closeTest}>
               <X size={21}/>
              </button>
             </div>

             <div className="test-progress">
              <span>Вопрос {testStep+1} из {testQuestions.length}</span>
              <div className="test-progress-track">
               <div
                className="test-progress-fill"
                style={{width:`${((testStep+1)/testQuestions.length)*100}%`}}
               />
              </div>
             </div>

             <div className="test-question">
              <h4>{testQuestions[testStep].question}</h4>

              <div className="test-options">
               {testQuestions[testStep].options.map((option,index)=>
                <button
                 key={index}
                 className={`test-option ${testAnswer===index?"selected":""}`}
                 onClick={()=>setTestAnswer(index)}
                >
                 <span>{String.fromCharCode(65+index)}</span>
                 {option.text}
                </button>
               )}
              </div>
             </div>

             <div className="test-modal-footer">
              <button className="test-cancel-btn" onClick={closeTest}>
               Отмена
              </button>
              <button
               className="test-next-btn"
               disabled={testAnswer===null}
               onClick={submitTest}
              >
               {testStep===testQuestions.length-1?"Завершить тест":"Следующий вопрос"}
              </button>
             </div>
            </>
            :
            <div className="test-result">
             <div className={`test-result-icon ${testPassed?"success":"fail"}`}>
              {testPassed?<Check size={34}/>:<X size={34}/>}
             </div>

             <h3>{testPassed?"Тестирование пройдено":"Тестирование не пройдено"}</h3>

             <p>
              Результат: <strong>{testScore} из {testTotal} ({testPercent}%)</strong>
             </p>

             <span>
              {testPassed
               ?"Инструкция отмечена как изученная."
               :`Нужно набрать минимум ${testRequiredCorrect} правильных ответов из ${testTotal}.`}
             </span>

             {testSaving&&
              <div className="test-status-note">Сохраняем результат…</div>
             }

             {testSaveError&&
              <div className="test-error-note">{testSaveError}</div>
             }

             <button className="test-next-btn test-result-btn" onClick={closeTest}>
              Закрыть
             </button>
            </div>
           }

          </div>
         </div>
        }

        {active==="question"&&
     <section className="question-page">
      {!questionChat.length?
       <div className={"question-hero "+(questionTransitioning?"question-fading":"")}>
        <img
         className="question-robot"
         src="./ortona-ai-teacher.png"
         alt="Ортона-AI"
        />
        <h2>Задайте свой вопрос.</h2>
       </div>
       :
       <div className="chat-messages">
        {questionChat.map((entry,index)=>
         entry.role==="user"
          ?<div className="chat-message user-message" key={index}>
            <div className="chat-bubble">{entry.content}</div>
           </div>
          :<div className="chat-message agent-message" key={index}>
            <div className="chat-bubble">
             <div className="question-answer-text">{entry.content}</div>

             {Array.isArray(entry.sources)&&entry.sources.length>0&&
              <div className="question-sources">
               <span className="question-sources-label">Источники</span>
               {entry.sources.map((source,sourceIndex)=>
                <div className="question-source" key={sourceIndex}>
                 <strong>{source.name}</strong>
                 {source.url&&<a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>}
                 {source.fragment&&<p>{source.fragment}</p>}
                </div>
               )}
              </div>
             }
            </div>
           </div>
        )}

        {questionLoading&&
         <div className="chat-message agent-message">
          <div className="chat-bubble">Ищу информацию в базе знаний...</div>
         </div>
        }

        {questionError&&<div className="login-error">{questionError}</div>}
       </div>
      }
     </section>
    }


    {interviewOpen &&
     <div className="interview-overlay">
      <div className="interview-modal">
       <div className="interview-modal-header">
        <div>
         <span className="interview-kicker">ИНТЕРВЬЮ</span>
         <h2>Проверка знаний</h2>
        </div>
        <button className="interview-close" onClick={()=>setInterviewOpen(false)}>
         <X size={21}/>
        </button>
       </div>

       {!interviewFinished?
        <>
       <div className="interview-progress">
        <div className="interview-progress-top">
         <span>Вопрос {interviewStep}</span>
         <strong>{Math.min(Math.round((interviewStep/15)*100),100)}%</strong>
        </div>
        <div className="interview-progress-bar">
         <div style={{width:Math.min((interviewStep/15)*100,100)+"%"}}></div>
        </div>
       </div>

       <div className="interview-question">
        <span>Вопрос {interviewStep}</span>
        <h3>
         {interviewLoading&&interviewHistory.length===0
          ?"Ортона-AI готовит первый вопрос..."
          :(interviewHistory.filter(item=>item.role==="assistant").slice(-1)[0]?.content||"Ожидание вопроса...")}
        </h3>
        {interviewError&&<div className="login-error">{interviewError}</div>}
        {interviewSavedNote&&<div className="interview-saved-note">{interviewSavedNote}</div>}
        {interviewInstructionLoading&&
         <div className="interview-instruction-status">Ортона-AI формирует готовый текст инструкции...</div>
        }
        {interviewInstructionError&&
         <div className="interview-instruction-errorbox">
          <div className="login-error">{interviewInstructionError}</div>
          <button
           className="interview-instruction-retry"
           disabled={interviewInstructionLoading||!interviewProcess||!interviewSavedProcessId}
           onClick={retryInstructionGeneration}
          >
           Повторить генерацию инструкции
          </button>
         </div>
        }
       </div>

       {interviewScreenshotRequest&&
        <div className="interview-screenshot-box">
         <input
          ref={interviewFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleInterviewScreenshot}
          style={{display:"none"}}
         />
         <button
          type="button"
          className="interview-attach-button"
          onClick={()=>interviewFileRef.current?.click()}
          disabled={interviewLoading}
         >
          <Paperclip size={19}/>
          Прикрепить скриншот
         </button>

         {interviewScreenshot&&
          <div className="interview-screenshot-preview">
           <span>{interviewScreenshot.name}</span>
           <button
            type="button"
            onClick={()=>{
             setInterviewScreenshot(null);
             if(interviewFileRef.current)interviewFileRef.current.value="";
            }}
            disabled={interviewLoading}
            aria-label="Удалить скриншот"
           >
            <X size={17}/>
           </button>
          </div>
         }
        </div>
       }

       <textarea
        className="interview-answer"
        value={interviewAnswer}
        onChange={e=>setInterviewAnswer(e.target.value)}
        placeholder={interviewScreenshotRequest?"Добавьте комментарий к скриншоту (необязательно)...":"Введите ваш ответ..."}
       />

       <div className="interview-modal-footer">
        <span>
         {interviewScreenshotRequest
          ?"Прикрепите скриншот и нажмите «Отправить»"
          :"Ответ можно изменить до перехода к следующему вопросу"}
        </span>
        <button
          className="interview-next"
          disabled={interviewLoading||(!interviewAnswer.trim()&&!interviewScreenshot)}
          onClick={sendInterviewAnswer}
         >
          {interviewLoading?"Ортона-AI думает...":interviewScreenshot?"Отправить":"Ответить"}
          <ChevronRight size={19}/>
         </button>
       </div>
        </>
        :
        <div className="interview-finish">
         <div className="interview-finish-icon"><Check size={34}/></div>
         <h3>Интервью записано</h3>
         <p>Спасибо! Интервью успешно завершено и сохранено.</p>
         {interviewInstructionLoading&&
          <div className="interview-finish-status">Ортона-AI готовит текст инструкции. Это занимает пару минут — можно закрыть окно и вернуться позже.</div>
         }
         {!interviewInstructionLoading&&interviewSavedProcessId&&!interviewInstructionError&&
          <div className="interview-finish-status">Готовая инструкция добавлена к процессу.</div>
         }
         {!interviewInstructionLoading&&interviewInstructionError&&
          <div className="interview-finish-status interview-finish-status-warn">
           <span>Текст инструкции сейчас не сформирован. Его можно создать позже в карточке процесса.</span>
           <button
            className="interview-instruction-retry"
            disabled={interviewInstructionLoading||!interviewProcess||!interviewSavedProcessId}
            onClick={retryInstructionGeneration}
           >
            Повторить попытку
           </button>
          </div>
         }
         {interviewSaveFailed&&
          <div className="interview-finish-status interview-finish-status-warn">
           <span>Результат интервью не удалось сохранить автоматически.</span>
          </div>
         }
         <button className="interview-finish-close" onClick={()=>setInterviewOpen(false)}>Закрыть</button>
        </div>
       }
      </div>
     </div>
    }

    {active==="question"&&
     <div className="composer-area">
      <div className="composer">
       <button className="attach"><Paperclip size={22}/></button>

       <input
        value={message}
        onChange={e=>setMessage(e.target.value)}
        onKeyDown={e=>{
         if(e.key==="Enter"&&!e.shiftKey){
          e.preventDefault();
          sendMessage();
         }
        }}
        placeholder="Напишите сообщение..."
       />

       <button className="send" onClick={sendMessage}>
        <Send size={21}/>
       </button>
      </div>

      <div className="composer-hint">
       Нажмите Enter для отправки&nbsp;&nbsp;•&nbsp;&nbsp;Shift + Enter для новой строки
      </div>
     </div>
    }

   </main>
  </div>
 </div>;
}

createRoot(document.getElementById("root")).render(<App/>);
