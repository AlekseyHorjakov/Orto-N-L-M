import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, ChevronDown, ChevronRight, Users, UserRound, GraduationCap, MessageCircle, BriefcaseBusiness, FileText, Send, Paperclip, Plus, Pencil, Trash2, X, Check, ArrowLeft, Search } from "lucide-react";
import "./styles.css";

const menu=[
 {key:"manager",label:"Руководитель",icon:UserRound},
 {key:"specialist",label:"Специалист",icon:Users},
 {key:"trainee",label:"Стажер",icon:GraduationCap},
 {key:"question",label:"Задать вопрос",icon:MessageCircle}
];

const defaultPositions=["Администратор","Протезист","Ортезист"];
const testQuestions=[
 {question:"Как следует действовать при выполнении этой инструкции?",options:["Следовать установленному порядку действий","Пропустить обязательные этапы","Действовать без проверки"],correct:0},
 {question:"Что является главным при выполнении рабочей инструкции?",options:["Соблюдение установленного порядка","Скорость любой ценой","Пропуск документации"],correct:0},
 {question:"Что делать, если возникла нестандартная ситуация?",options:["Действовать по инструкции и уточнить порядок действий","Игнорировать ситуацию","Самостоятельно пропустить этап"],correct:0}
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

 const [active,setActive]=useState("manager");
 const [section,setSection]=useState("home");

 const [positions,setPositions]=useState(()=>JSON.parse(localStorage.getItem("ortona_positions")||"null")||defaultPositions);
 const [instructions,setInstructions]=useState(()=>JSON.parse(localStorage.getItem("ortona_instructions")||"null")||defaultInstructions);

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
 const [completedInstructions,setCompletedInstructions]=useState([]);
 const [openedTraineeInstructions,setOpenedTraineeInstructions]=useState([]);
 const [testingInstruction,setTestingInstruction]=useState(null);
 const [testResults,setTestResults]=useState({});
 const [testStep,setTestStep]=useState(0);
 const [testAnswer,setTestAnswer]=useState(null);
 const [testScore,setTestScore]=useState(0);
 const [testFinished,setTestFinished]=useState(false);
 const [interviewOpen,setInterviewOpen]=useState(false);
 const [interviewStep,setInterviewStep]=useState(1);
 const [interviewAnswer,setInterviewAnswer]=useState("");

 useEffect(()=>localStorage.setItem("ortona_positions",JSON.stringify(positions)),[positions]);
 useEffect(()=>localStorage.setItem("ortona_instructions",JSON.stringify(instructions)),[instructions]);

 const selectMenu=key=>{
  setActive(key);
  setSection(key==="manager"?"home":"chat");
  setSelectedInstruction(null);
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

const startTest=(item)=>{
  setTestingInstruction(item);
  setTestStep(0);
  setTestAnswer(null);
  setTestScore(0);
  setTestFinished(false);
 };

 const closeTest=()=>{
  setTestingInstruction(null);
  setTestStep(0);
  setTestAnswer(null);
  setTestScore(0);
  setTestFinished(false);
 };

 const submitTest=()=>{
  if(testAnswer===null)return;

  const current=testQuestions[testStep];
  const nextScore=testScore+(testAnswer===current.correct?1:0);

  setTestScore(nextScore);

  if(testStep<testQuestions.length-1){
   setTestStep(testStep+1);
   setTestAnswer(null);
  }else{
   const percent=Math.round((nextScore/testQuestions.length)*100);

   if(testingInstruction){
    setTestResults(prev=>({
     ...prev,
     [testingInstruction.id]:percent
    }));

    if(percent>=80){
     setCompletedInstructions(prev=>
      prev.includes(testingInstruction.id)
       ? prev
       : [...prev,testingInstruction.id]
     );
    }
   }

   setTestFinished(true);
  }
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

 const addPosition=()=>{
  setAddingPosition(true);
  setEditingPosition(null);
  setPositionDraft("");
 };

 const saveNewPosition=()=>{
  const value=positionDraft.trim();
  if(!value)return;
  setPositions([...positions,value]);
  setPositionDraft("");
  setAddingPosition(false);
 };

 const startEditPosition=index=>{
  setEditingPosition(index);
  setAddingPosition(false);
  setPositionDraft(positions[index]);
 };

 const savePosition=()=>{
  const value=positionDraft.trim();
  if(!value||editingPosition===null)return;
  setPositions(positions.map((p,i)=>i===editingPosition?value:p));
  setEditingPosition(null);
  setPositionDraft("");
 };

 const removePosition=index=>{
  if(window.confirm(`Удалить должность «${positions[index]}»?`))
   setPositions(positions.filter((_,i)=>i!==index));
 };

 const startAddInstruction=()=>{
  setAddingInstruction(true);
  setEditingInstruction(null);
  setInstructionDraft({title:"",position:positions[0]||"",text:""});
 };

 const saveInstruction=()=>{
  const title=instructionDraft.title.trim();
  const text=instructionDraft.text.trim();
  if(!title||!text||!instructionDraft.position)return;

  setInstructions([...instructions,{
   id:Date.now(),
   title,
   position:instructionDraft.position,
   text
  }]);

  setAddingInstruction(false);
  setInstructionDraft({title:"",position:"",text:""});
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

 const saveEditedInstruction=()=>{
  const title=instructionDraft.title.trim();
  const text=instructionDraft.text.trim();
  if(!title||!text||!instructionDraft.position)return;

  setInstructions(instructions.map(item=>
   item.id===editingInstruction
    ? {...item,title,position:instructionDraft.position,text}
    : item
  ));

  setEditingInstruction(null);
  setInstructionDraft({title:"",position:"",text:""});
 };

 const removeInstruction=id=>{
  const item=instructions.find(x=>x.id===id);
  if(item&&window.confirm(`Удалить инструкцию «${item.title}»?`))
   setInstructions(instructions.filter(x=>x.id!==id));
 };

  const sendMessage=()=>{
  const value=message.trim();
  if(!value||questionTransitioning)return;

  if(active==="question"){
   setQuestionTransitioning(true);

   setTimeout(()=>{
    setQuestionAsked(value);
    setQuestionTransitioning(false);
    setMessage("");
   },700);

   return;
  }

  setMessage("");
 };

 const handleLogin=()=>{
  if(login.trim()==="admin" && password==="admin"){
   setAuthenticated(true);
   setLoginError("");
   setPassword("");
  }else{
   setLoginError("Неверный логин или пароль");
  }
 };

 const specialistInstructions=instructions.filter(item=>{
  const matchesPosition=!specialistPosition||item.position===specialistPosition;
  const q=instructionSearch.trim().toLowerCase();
  const matchesSearch=!q||
   item.title.toLowerCase().includes(q)||
   item.text.toLowerCase().includes(q);
  return matchesPosition&&matchesSearch;
 });

 if(!authenticated){
  return <div className="login-page">
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
    <button className="icon-button">
     <Bell size={21}/>
     <span className="notification-dot"/>
    </button>

    <div className="profile">
     <div className="avatar">А</div>
     <div>
      <strong>Алексей</strong>
      <span>Системный администратор</span>
     </div>
     <ChevronDown size={17}/>
    </div>

    <div className="logo-wrap">
     <img src="./ortho-n-logo.png" alt="ORTO-N"/>
    </div>
   </div>
  </header>

  <div className="layout">

   <aside className="sidebar">
    <h2>МЕНЮ</h2>

    <nav>
     {menu.map(({key,label,icon:Icon})=>
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
        <div className="position-row" key={`${position}-${index}`}>
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
            <span>{position}</span>
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
          {positions.map(p=><option key={p} value={p}>{p}</option>)}
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
           {positions.map(p=><option key={p} value={p}>{p}</option>)}
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
         <button className="interview-launch-button" onClick={()=>setInterviewOpen(true)}>
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
         {positions.map(p=><option key={p} value={p}>{p}</option>)}
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
              disabled
             >
              <Check size={18}/>
              100%
             </button>
            ) : testResults[item.id] >= 80 ? (
             <button
              className="trainee-test-btn trainee-test-result trainee-test-result-passed"
              disabled
             >
              <Check size={18}/>
              {testResults[item.id]}%
             </button>
            ) : (
             <button
              className="trainee-test-btn trainee-test-result trainee-test-result-failed"
              onClick={()=>startTest(item)}
             >
              <X size={18}/>
              Попробуйте ещё раз
             </button>
            )
           ) : (
            <button
             className="trainee-test-btn"
             disabled={!done}
             onClick={()=>startTest(item)}
            >
             Пройти тестирование
            </button>
           )}

           <button
            disabled={!openedTraineeInstructions.includes(item.id) && !done}
            onClick={()=>{
             if(!openedTraineeInstructions.includes(item.id) && !done) return;

             setCompletedInstructions(
              done
               ? completedInstructions.filter(id=>id!==item.id)
               : [...completedInstructions,item.id]
             )
            }}
           >
            {done?"✓ Изучено":"Отметить изученным"}
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

           {!testFinished?
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
                 {option}
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
             <div className={`test-result-icon ${testScore>=2?"success":"fail"}`}>
              {testScore>=2?<Check size={34}/>:<X size={34}/>}
             </div>

             <h3>{testScore>=2?"Тестирование пройдено":"Тестирование не пройдено"}</h3>

             <p>
              Результат: <strong>{testScore} из {testQuestions.length}</strong>
             </p>

             <span>
              {testScore>=2
               ?"Инструкция отмечена как изученная."
               :"Нужно набрать минимум 2 правильных ответа."}
             </span>

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
      {!questionAsked?
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
        <div className="chat-message user-message">
         <div className="chat-bubble">
          {questionAsked}
         </div>
        </div>

        <div className="chat-message agent-message">
         <div className="chat-bubble">
          Готов помочь. Задавайте вопрос.
         </div>
        </div>
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

       <div className="interview-progress">
        <div className="interview-progress-top">
         <span>Вопрос {interviewStep} из 5</span>
         <strong>{interviewStep*20}%</strong>
        </div>
        <div className="interview-progress-bar">
         <div style={{width:(interviewStep*20)+"%"}}></div>
        </div>
       </div>

       <div className="interview-question">
        <span>Вопрос {interviewStep}</span>
        <h3>
         {interviewStep===1
          ?"Как вы будете действовать при первичном обращении нового пациента?"
          :interviewStep===2
          ?"Какие данные необходимо уточнить у пациента перед началом работы?"
          :interviewStep===3
          ?"Как вы проверяете правильность оформления информации?"
          :interviewStep===4
          ?"Что вы будете делать, если не знаете правильного порядка действий?"
          :"Расскажите о ключевых правилах вашей должности."
         }
        </h3>
       </div>

       <textarea
        className="interview-answer"
        value={interviewAnswer}
        onChange={e=>setInterviewAnswer(e.target.value)}
        placeholder="Введите ваш ответ..."
       />

       <div className="interview-modal-footer">
        <span>Ответ можно изменить до перехода к следующему вопросу</span>
        <button
         className="interview-next"
         onClick={()=>{
          if(interviewStep<5){
           setInterviewStep(interviewStep+1);
           setInterviewAnswer("");
          }else{
           setInterviewOpen(false);
           setInterviewStep(1);
           setInterviewAnswer("");
          }
         }}
        >
         {interviewStep<5?"Следующий вопрос":"Завершить интервью"}
         <ChevronRight size={19}/>
        </button>
       </div>
      </div>
     </div>
    }

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

   </main>
  </div>
 </div>;
}

createRoot(document.getElementById("root")).render(<App/>);
