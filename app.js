// ── State ──────────────────────────────────────
const users={};
let currentUser=null,isGuest=false;
let balance=1000,pendingBet=null,betHistory=[],txLedger=[];
let periodSeq=1,slotSec=60,slotTimer=null,locked=false;
let totalWins=0,totalLosses=0,totalDeposited=0,totalWonAmt=0,bestStreak=0,curStreak=0;
let refCount=0;

// ── Pages & Navigation ─────────────────────────
function goPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function switchNav(tab){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('nav-'+tab).classList.add('active');
  if(tab==='account'){refreshAccount();goPage('page-account');}
  else if(tab==='aviator'){
    aviBalance=balance;
    goPage('page-aviator');
    if(!aviLoaded){aviInit();aviLoaded=true;}
    else{aviUpdateStats();}
  }
  else if(tab==='ab'){
    goPage('page-ab');
    abSyncBalance();
    if(AB.state==='idle') abNewRound();
  }
  else if(tab==='ludo'){
    goPage('page-ludo');
    ludoSyncBalance();
    ludoShow('lobby');
    ludoRenderRooms();
  }
  else{
    goPage('page-game');
    if(tab==='history')setTimeout(()=>document.getElementById('hdots').scrollIntoView({behavior:'smooth'}),120);
  }
}
function showNav(){document.getElementById('bottomNav').classList.add('visible');}
function hideNav(){document.getElementById('bottomNav').classList.remove('visible');}

// ── Auth ───────────────────────────────────────
function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  const err=document.getElementById('login-err');
  if(!email||!pass){err.classList.add('show');return;}
  const u=users[email];
  if(!u||u.pass!==pass){err.classList.add('show');return;}
  err.classList.remove('show');
  currentUser={email,...u};isGuest=false;
  enterApp();
}
function doSignup(){
  const fn=document.getElementById('su-fname').value.trim(),ln=document.getElementById('su-lname').value.trim();
  const email=document.getElementById('su-email').value.trim(),phone=document.getElementById('su-phone').value.trim();
  const p=document.getElementById('su-pass').value,p2=document.getElementById('su-pass2').value;
  const err=document.getElementById('signup-err');
  if(!fn||!ln||!email||!phone||!p||p.length<6||p!==p2){
    err.textContent=p!==p2?'Passwords do not match.':'Please fill all fields correctly.';
    err.classList.add('show');return;
  }
  if(users[email]){err.textContent='Email already registered.';err.classList.add('show');return;}
  err.classList.remove('show');
  const joined=new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  users[email]={name:`${fn} ${ln}`,pass:p,phone,joined,city:'',dob:''};
  currentUser={email,...users[email]};isGuest=false;
  enterApp();
}
function guestLogin(){
  currentUser={email:'guest@wingo.app',name:'Guest Player',phone:'—',joined:'March 2026',city:'',dob:''};
  isGuest=true;enterApp();
}
function enterApp(){
  balance=1000;pendingBet=null;betHistory=[];txLedger=[];
  periodSeq=1;locked=false;totalWins=0;totalLosses=0;totalDeposited=0;totalWonAmt=0;
  // reset aviator
  aviBalance=1000;aviLoaded=false;aviTotalWon=0;aviTotalLost=0;
  showBal();updatePending();renderHistory();showNav();
  goPage('page-game');startSlot();
  AB.state='idle';AB.history=[];AB.andarCards=[];AB.baharCards=[];AB.joker=null;
  // set referral code
  const code='WINGO'+String(Math.floor(Math.random()*900+100));
  document.getElementById('referCode').textContent=code;
  // prefill profile
  if(currentUser.name&&currentUser.name!=='Guest Player'){
    const parts=currentUser.name.split(' ');
    document.getElementById('prof-fname').value=parts[0]||'';
    document.getElementById('prof-lname').value=parts.slice(1).join(' ')||'';
  }
  document.getElementById('prof-email').value=currentUser.email||'';
  document.getElementById('prof-phone').value=currentUser.phone||'';
  showToast(`Welcome, ${currentUser.name.split(' ')[0]}! 🎉`,'win');
}
function doLogout(){
  if(slotTimer)clearInterval(slotTimer);
  currentUser=null;isGuest=false;hideNav();goPage('page-login');
  showToast('Signed out successfully','info');
}

// ── Account refresh ────────────────────────────
function refreshAccount(){
  const u=currentUser||{};
  const n=u.name||'Player';
  document.getElementById('accAvatar').textContent=n.charAt(0).toUpperCase();
  document.getElementById('accName').textContent=n;
  document.getElementById('accEmail').textContent=u.email||'';
  document.getElementById('accJoined').textContent=`🗓 Joined ${u.joined||'—'}`;
  document.getElementById('wsBalance').textContent=`₹${Math.round(balance).toLocaleString('en-IN')}`;
  document.getElementById('wsDeposited').textContent=`₹${Math.round(totalDeposited).toLocaleString('en-IN')}`;
  document.getElementById('wsWon').textContent=`₹${Math.round(totalWonAmt).toLocaleString('en-IN')}`;
  const rounds=totalWins+totalLosses;
  document.getElementById('stRounds').textContent=rounds;
  document.getElementById('stWins').textContent=totalWins;
  document.getElementById('stLosses').textContent=totalLosses;
  document.getElementById('stWinRate').textContent=rounds?Math.round(totalWins/rounds*100)+'%':'0%';
  document.getElementById('wd-bal').textContent=`₹${Math.round(balance).toLocaleString('en-IN')}`;
}

// ── Modals ─────────────────────────────────────
function openModal(id){
  if(id==='modal-txhistory')renderTxTable('all');
  if(id==='modal-faq')renderFaq();
  document.getElementById(id).classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function overlayClose(e,el){if(e.target===el)el.classList.remove('open');}

// ── Deposit & Withdraw ─────────────────────────
function doDeposit(){
  const amt=parseInt(document.getElementById('dep-amt').value);
  const err=document.getElementById('dep-err'),ok=document.getElementById('dep-ok');
  if(!amt||amt<50){err.classList.add('show');ok.classList.remove('show');return;}
  err.classList.remove('show');
  balance+=amt;totalDeposited+=amt;
  document.getElementById('dep-ok-amt').textContent=amt.toLocaleString('en-IN');
  ok.classList.add('show');
  addTx('dep',`DEP-${Date.now().toString().slice(-6)}`,amt);
  showBal();refreshAccount();
  document.getElementById('dep-amt').value='';
  document.querySelectorAll('#modal-deposit .ap').forEach(a=>a.classList.remove('sel'));
  showToast(`₹${amt} added to wallet! 💳`,'win');
  setTimeout(()=>ok.classList.remove('show'),3000);
}

function doWithdraw(){
  const amt=parseInt(document.getElementById('wd-amt').value);
  const bank=document.getElementById('wd-bank').value.trim();
  const err=document.getElementById('wd-err'),ok=document.getElementById('wd-ok');
  if(!amt||amt<100||amt>balance){err.textContent=amt>balance?'Insufficient balance.':'Min withdrawal ₹100.';err.classList.add('show');ok.classList.remove('show');return;}
  if(!bank){err.textContent='Enter bank account or UPI ID.';err.classList.add('show');return;}
  err.classList.remove('show');
  balance-=amt;
  document.getElementById('wd-ok-amt').textContent=amt.toLocaleString('en-IN');
  ok.classList.add('show');
  addTx('wd',`WD-${Date.now().toString().slice(-6)}`,-amt);
  showBal();refreshAccount();
  document.getElementById('wd-amt').value='';document.getElementById('wd-bank').value='';document.getElementById('wd-ifsc').value='';
  document.querySelectorAll('#modal-withdraw .ap').forEach(a=>a.classList.remove('sel'));
  showToast(`₹${amt} withdrawal requested 🏦`,'info');
  setTimeout(()=>ok.classList.remove('show'),3000);
}

// ── Profile & Password ─────────────────────────
function saveProfile(){
  const fn=document.getElementById('prof-fname').value.trim();
  const ln=document.getElementById('prof-lname').value.trim();
  const email=document.getElementById('prof-email').value.trim();
  const phone=document.getElementById('prof-phone').value.trim();
  const city=document.getElementById('prof-city').value.trim();
  if(!fn||!email){showToast('Name and email are required','lose');return;}
  currentUser.name=`${fn} ${ln}`.trim();
  currentUser.email=email;currentUser.phone=phone;currentUser.city=city;
  if(users[currentUser.email]){users[currentUser.email]={...users[currentUser.email],...currentUser};}
  document.getElementById('prof-ok').classList.add('show');
  refreshAccount();
  showToast('Profile saved! ✅','win');
  setTimeout(()=>document.getElementById('prof-ok').classList.remove('show'),2500);
}

function changePassword(){
  const cur=document.getElementById('pwd-cur').value;
  const nw=document.getElementById('pwd-new').value;
  const nw2=document.getElementById('pwd-new2').value;
  const err=document.getElementById('pwd-err'),ok=document.getElementById('pwd-ok');
  if(isGuest){err.textContent='Guests cannot change password. Create an account first.';err.classList.add('show');return;}
  if(!cur||!nw||nw.length<6||nw!==nw2){err.textContent=nw!==nw2?'New passwords do not match.':'Fill all fields (min 6 chars).';err.classList.add('show');ok.classList.remove('show');return;}
  const u=users[currentUser.email];
  if(!u||u.pass!==cur){err.textContent='Current password is incorrect.';err.classList.add('show');return;}
  err.classList.remove('show');
  users[currentUser.email].pass=nw;
  ok.classList.add('show');
  document.getElementById('pwd-cur').value='';document.getElementById('pwd-new').value='';document.getElementById('pwd-new2').value='';
  showToast('Password changed! 🔐','win');
  setTimeout(()=>ok.classList.remove('show'),2500);
}

// ── Refer & Support ────────────────────────────
function copyCode(){
  const code=document.getElementById('referCode').textContent;
  navigator.clipboard?.writeText(code).catch(()=>{});
  showToast(`Code ${code} copied! 📋`,'win');
}

function saveNotif(){showToast('Notification preference saved ✅','info');}

function sendSupport(){
  const msg=document.getElementById('sup-msg').value.trim();
  if(!msg){showToast('Please enter your message','lose');return;}
  document.getElementById('sup-ok').classList.add('show');
  document.getElementById('sup-msg').value='';
  showToast('Message sent! We\'ll reply soon 💬','win');
  setTimeout(()=>document.getElementById('sup-ok').classList.remove('show'),3000);
}

// ── TX Ledger ──────────────────────────────────
function addTx(type,ref,amt){
  txLedger.unshift({type,ref,amt,date:new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short'})});
}
let txFilter='all';
function filterTx(f,el){
  txFilter=f;
  document.querySelectorAll('#tx-filters .ap').forEach(a=>a.classList.remove('sel'));
  el.classList.add('sel');
  renderTxTable(f);
}
function renderTxTable(f){
  const tbody=document.getElementById('tx-tbody');
  const rows=txFilter==='all'?txLedger:txLedger.filter(t=>t.type===f);
  if(!rows.length){tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">No transactions yet</td></tr>';return;}
  const typeMap={win:['txb-win','Win'],lose:['txb-lose','Loss'],dep:['txb-dep','Deposit'],wd:['txb-wd','Withdrawal']};
  tbody.innerHTML=rows.map(t=>{
    const[cls,lbl]=typeMap[t.type]||['','—'];
    const sign=t.amt>0?'+':'';
    const amtCls=t.type==='win'?'tx-win':t.type==='lose'?'tx-lose':t.type==='dep'?'tx-dep':'tx-lose';
    return `<tr>
      <td><span class="tx-type-badge ${cls}">${lbl}</span></td>
      <td style="font-family:'Orbitron',monospace;font-size:.72rem;color:var(--muted)">${t.ref}</td>
      <td class="${amtCls}">${sign}₹${Math.abs(t.amt).toFixed(0)}</td>
      <td style="color:var(--muted)">${t.date}</td>
    </tr>`;
  }).join('');
}

// ── FAQ ────────────────────────────────────────
const faqs=[
  ['How is the winning colour decided?','The result is a random number 0–9 drawn each minute. Numbers 1–4 are Red, 6–9 are Green. 0 is Red+Violet (small) and 5 is Green+Violet (big). The minority colour in the current pool tends to win.'],
  ['What are the payout multipliers?','Red & Green bets pay ×1.89 · Violet (numbers 0 or 5) pays ×4.00 · Big/Small pays ×1.89 · Any exact number pays ×9.00.'],
  ['When does betting lock?','Betting locks automatically 10 seconds before the draw. You can place your bet anytime in the first 50 seconds of the 1-minute period.'],
  ['How do I deposit money?','Go to Account → Add Money. We support UPI, Net Banking, Debit/Credit Card and IMPS/NEFT. Deposits are instant with no fees.'],
  ['How long does withdrawal take?','Withdrawals process within 1–24 hours depending on your bank. Minimum withdrawal is ₹100.'],
  ['Is my money safe?','Yes. Your wallet is secured and all transactions are encrypted. We follow responsible gaming guidelines.'],
  ['Can I play as a guest?','Yes, guest play gives you ₹1,000 demo balance to try the game. Create an account to use real money.'],
  ['How does the referral program work?','Share your unique code with friends. When they sign up and deposit ₹100+, both of you receive a ₹50 bonus.'],
];
function renderFaq(){
  document.getElementById('faq-list').innerHTML=faqs.map((f,i)=>`
    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(${i},this)">${f[0]}<span>+</span></button>
      <div class="faq-a" id="faq-a-${i}">${f[1]}</div>
    </div>`).join('');
}
function toggleFaq(i,btn){
  const a=document.getElementById('faq-a-'+i);
  const open=a.classList.contains('open');
  document.querySelectorAll('.faq-a').forEach(el=>el.classList.remove('open'));
  document.querySelectorAll('.faq-q').forEach(el=>el.classList.remove('open'));
  if(!open){a.classList.add('open');btn.classList.add('open');}
}

function pickAmt(inputId,val,el){
  document.getElementById(inputId).value=val;
  el.closest('.amount-pills').querySelectorAll('.ap').forEach(a=>a.classList.remove('sel'));
  el.classList.add('sel');
}

// ── Toast ──────────────
let toastT;
function showToast(msg,type){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className=`toast show ${type}`;
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2800);
}

// ═══════════════════════════════════════════════
// WIN GO GAME LOGIC
// ═══════════════════════════════════════════════
function numInfo(n){
  const sz=n<=4?'small':'big';
  if(n===0)return{cls:'rv',primary:'red',secondary:'violet',label:'Red · Violet',size:sz};
  if(n<=4) return{cls:'red',primary:'red',secondary:null,label:'Red',size:sz};
  if(n===5)return{cls:'gv',primary:'green',secondary:'violet',label:'Green · Violet',size:sz};
           return{cls:'green',primary:'green',secondary:null,label:'Green',size:sz};
}
(function(){
  const g=document.getElementById('ngrid');
  [0,1,2,3,4,5,6,7,8,9].forEach(i=>{
    const info=numInfo(i);
    const b=document.createElement('button');
    b.className=`nb nb-${info.cls}`;
    b.innerHTML=`${i}<span class="nx">×9</span>`;
    b.onclick=()=>placeBet('number',i);
    g.appendChild(b);
  });
})();

function showBal(){
  document.getElementById('balAmt').textContent=`₹${balance.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  abSyncBalance();
  ludoSyncBalance();
}
function periodId(){
  const d=new Date();
  return`${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}${String(periodSeq).padStart(4,'0')}`;
}
function p2(n){return String(n).padStart(2,'0');}

function startSlot(){
  slotSec=60;locked=false;
  document.getElementById('periodId').textContent=periodId();
  tickTimer();
  if(slotTimer)clearInterval(slotTimer);
  slotTimer=setInterval(()=>{
    slotSec--;tickTimer();
    if(slotSec===10&&!locked)lockPhase();
    if(slotSec<=0){clearInterval(slotTimer);doResult();}
  },1000);
}
function tickTimer(){
  const m=Math.floor(slotSec/60),s=slotSec%60;
  const el=document.getElementById('timerVal');
  el.textContent=`${p2(m)}:${p2(s)}`;
  el.className='timer-val'+(slotSec<=10?' danger':'');
  const bar=document.getElementById('progBar');
  bar.style.width=(slotSec/60*100)+'%';
  bar.className='prog-bar'+(slotSec<=10?' danger':'');
}
function lockPhase(){
  locked=true;showToast('🔒 Betting locked!','info');
  document.querySelectorAll('.cbtn,.nb,.qb,.sbtn').forEach(b=>{b.style.opacity='.35';b.style.pointerEvents='none';});
  document.getElementById('rIdle').style.display='none';
  document.getElementById('rSpin').style.display='flex';
  document.getElementById('rShow').style.display='none';
}
function unlockBtns(){
  document.querySelectorAll('.cbtn,.nb,.qb,.sbtn').forEach(b=>{b.style.opacity='';b.style.pointerEvents='';});
}
function doResult(){
  const num=Math.floor(Math.random()*10);
  const info=numInfo(num);
  const cp=periodId();
  let won=false,winAmt=0;
  const bet=pendingBet;
  if(bet){
    if(bet.type==='number'&&bet.value===num){won=true;winAmt=bet.amount*9;}
    else if(bet.type==='red'&&(info.primary==='red'||info.secondary==='red')){won=true;winAmt=bet.amount*1.89;}
    else if(bet.type==='green'&&(info.primary==='green'||info.secondary==='green')){won=true;winAmt=bet.amount*1.89;}
    else if(bet.type==='violet'&&info.secondary==='violet'){won=true;winAmt=bet.amount*4;}
    else if(bet.type==='big'&&info.size==='big'){won=true;winAmt=bet.amount*1.89;}
    else if(bet.type==='small'&&info.size==='small'){won=true;winAmt=bet.amount*1.89;}
    const ro=document.getElementById('rOut');
    if(won){
      balance+=winAmt;totalWins++;totalWonAmt+=winAmt;
      showToast(`🎉 WIN! +₹${winAmt.toFixed(0)}`,'win');
      ro.textContent=`WIN  +₹${winAmt.toFixed(0)}`;ro.className='r-out r-win';
      addTx('win',cp,winAmt);
    }else{
      totalLosses++;
      showToast(`❌ Lost ₹${bet.amount}`,'lose');
      ro.textContent=`LOST  −₹${bet.amount}`;ro.className='r-out r-lose';
      addTx('lose',cp,-bet.amount);
    }
  }else{
    document.getElementById('rOut').textContent='No bet this round';
    document.getElementById('rOut').className='r-out r-nobet';
  }
  document.getElementById('rPeriod').textContent=`PERIOD  ${cp}`;
  const bub=document.getElementById('rBubble');bub.textContent=num;bub.className=`rbubble rb-${info.cls}`;
  const ctEl=document.getElementById('rColorTag');
  const tm={red:['rtag-red','RED'],green:['rtag-green','GREEN'],rv:['rtag-mix','RED · VIOLET'],gv:['rtag-mixgv','GREEN · VIOLET']};
  const[tc,tt]=tm[info.cls]||['rtag-red','RED'];ctEl.textContent=tt;ctEl.className=`r-tag ${tc}`;
  const stEl=document.getElementById('rSizeTag');
  if(info.size==='big'){stEl.textContent='🔼 BIG';stEl.className='r-size-tag rst-big';}
  else{stEl.textContent='🔽 SMALL';stEl.className='r-size-tag rst-small';}
  document.getElementById('rSpin').style.display='none';
  document.getElementById('rShow').style.display='flex';
  betHistory.unshift({num,info,period:cp});
  if(betHistory.length>20)betHistory.pop();
  renderHistory();
  pendingBet=null;showBal();updatePending();unlockBtns();periodSeq++;
  setTimeout(()=>{document.getElementById('rIdle').style.display='';document.getElementById('rShow').style.display='none';startSlot();},3500);
}
function sb(v){document.getElementById('betAmt').value=v;}
function dbl(){const v=parseInt(document.getElementById('betAmt').value)||100;document.getElementById('betAmt').value=Math.min(v*2,balance);}
function hlf(){const v=parseInt(document.getElementById('betAmt').value)||100;document.getElementById('betAmt').value=Math.max(Math.floor(v/2),10);}
function placeBet(type,numVal){
  if(locked){showToast('🔒 Betting locked!','lose');return;}
  const amount=parseInt(document.getElementById('betAmt').value);
  if(!amount||amount<10){showToast('Min bet ₹10','lose');return;}
  if(amount>balance){showToast('Insufficient balance!','lose');return;}
  balance-=amount;showBal();
  pendingBet={type,value:numVal??null,amount};updatePending();
  const mult=type==='number'?9:type==='violet'?4:1.89;
  const lbl=type==='number'?`#${numVal}`:type==='big'?'BIG':type==='small'?'SMALL':type==='violet'?'VIOLET':type.toUpperCase();
  showToast(`✅ ${lbl} · ₹${amount} → ₹${(amount*mult).toFixed(0)}`,'info');
}
function updatePending(){
  const el=document.getElementById('pendingEl');
  if(pendingBet){
    const{type,value,amount}=pendingBet;
    const m=type==='number'?9:type==='violet'?4:1.89;
    const t=type==='number'?`Number ${value}`:type==='big'?'BIG (5–9)':type==='small'?'SMALL (0–4)':type==='violet'?'VIOLET':type.toUpperCase();
    el.innerHTML=`<div class="pdot"></div><span>Bet on <strong>${t}</strong> · ₹${amount} · Wins ₹${(amount*m).toFixed(0)}</span>`;
    el.classList.add('on');
  }else{
    el.innerHTML='<span>Select colour, size or number to bet ↓</span>';
    el.classList.remove('on');
  }
}
function doReset(){
  if(slotTimer)clearInterval(slotTimer);
  balance=1000;pendingBet=null;betHistory=[];txLedger=[];periodSeq=1;locked=false;totalWins=0;totalLosses=0;totalDeposited=0;totalWonAmt=0;
  renderHistory();showBal();updatePending();unlockBtns();
  document.getElementById('rIdle').style.display='';
  document.getElementById('rSpin').style.display='none';
  document.getElementById('rShow').style.display='none';
  startSlot();showToast('Game reset! ₹1,000 added 💰','win');
}
function renderHistory(){
  const el=document.getElementById('hdots');
  if(!betHistory.length){el.innerHTML='<span style="color:var(--muted);font-size:.76rem;font-weight:500">No results yet</span>';return;}
  el.innerHTML=betHistory.map(h=>`
    <div class="hd-wrap" title="Period ${h.period} · ${h.info.label} · ${h.info.size.toUpperCase()}">
      <div class="hd-period">#${h.period.slice(-4)}</div>
      <div class="hd hd-${h.info.cls}">${h.num}</div>
      <div class="hd-sz" style="color:${h.info.size==='big'?'var(--blue)':'var(--amber)'}">${h.info.size==='big'?'B':'S'}</div>
    </div>`).join('');
}


// ═══════════════════════════════════════════════
// AVIATOR GAME ENGINE
// ═══════════════════════════════════════════════
let aviLoaded=false;
let aviBalance=1000,aviTotalWon=0,aviTotalLost=0;
let aviRoundHistory=[];
let aviMyBetLog=[];
let aviState='waiting'; // waiting | flying | crashed
let aviMult=1.00,aviTarget=0,aviSpeed=0,aviFrame=null;
let aviRoundTimer=null;
// Bet slots
let aviBetA={active:false,amount:0,cashedOut:false,cashoutMult:0,auto:false,autoVal:2.0};
let aviBetB={active:false,amount:0,cashedOut:false,cashoutMult:0,auto:false,autoVal:5.0};
// Canvas
let aviCtx,aviW,aviH;
let planeX=0,planeY=0;
let trailPoints=[];
// Fake players
const fakePlayers=['Raj***','Anu***','Sam***','Pri***','Dev***','Vik***','Moh***','Sur***','Kir***','Ash***','Rup***','Poo***','Nit***'];
let liveChips=[];

function aviInit(){
  const canvas=document.getElementById('aviCanvas');
  const sky=document.getElementById('aviSky');
  function resize(){
    aviW=sky.offsetWidth||360;
    aviH=sky.offsetHeight||260;
    canvas.width=aviW;canvas.height=aviH;
  }
  resize();
  window.addEventListener('resize',resize);
  aviCtx=canvas.getContext('2d');
  aviBalance=balance;
  aviUpdateStats();
  aviStartWaiting();
}

function aviUpdateStats(){
  const b=document.getElementById('aviStatBal');
  const w=document.getElementById('aviStatWon');
  const l=document.getElementById('aviStatLost');
  if(b)b.textContent='Rs.'+Math.round(aviBalance).toLocaleString('en-IN');
  if(w)w.textContent='Rs.'+Math.round(aviTotalWon).toLocaleString('en-IN');
  if(l)l.textContent='Rs.'+Math.round(aviTotalLost).toLocaleString('en-IN');
}

// ── Waiting phase ─────────────────────────────
function aviStartWaiting(){
  aviState='waiting';
  aviBetA={active:false,amount:0,cashedOut:false,cashoutMult:0,auto:aviBetA.auto,autoVal:aviBetA.autoVal};
  aviBetB={active:false,amount:0,cashedOut:false,cashoutMult:0,auto:aviBetB.auto,autoVal:aviBetB.autoVal};
  trailPoints=[];
  planeX=36;planeY=aviH-50;

  document.getElementById('aviCrashOverlay').classList.remove('show');
  document.getElementById('aviResultInfo').style.display='none';

  const multEl=document.getElementById('aviMult');
  const labelEl=document.getElementById('aviMultLabel');
  multEl.textContent='';
  multEl.className='avi-mult';

  let cd=5;
  labelEl.textContent='NEXT ROUND IN '+cd+'s';

  // Reset both bet buttons
  setAviBtnA('place','Place Bet');
  setAviBtnB('place','Place Bet 2');
  setAviBadge('A','BET OPEN','rgba(79,200,122,.15)','rgba(79,200,122,.4)','#4fc87a');
  setAviBadge('B','BET OPEN','rgba(58,142,246,.15)','rgba(58,142,246,.4)','#60aaff');
  setAviStatus('A','','abs-empty');
  setAviStatus('B','','abs-empty');
  document.getElementById('aviBetA').disabled=false;
  document.getElementById('aviBetB').disabled=false;

  generateFakeLive();renderFakeLive();

  if(aviRoundTimer)clearInterval(aviRoundTimer);
  aviRoundTimer=setInterval(function(){
    cd--;
    if(cd>0){
      labelEl.textContent='NEXT ROUND IN '+cd+'s';
      multEl.textContent=cd+'';
      multEl.style.fontSize='4rem';
      multEl.className='avi-mult';
    } else {
      multEl.textContent='';
      multEl.style.fontSize='3rem';
      labelEl.textContent='LAUNCHING!';
      clearInterval(aviRoundTimer);
      setTimeout(aviStartFlight,400);
    }
  },1000);

  aviDrawIdle();
}

// ── Flight phase ──────────────────────────────
function aviStartFlight(){
  aviState='flying';
  aviMult=1.00;
  aviTarget=generateCrashPoint();
  aviSpeed=0.014+Math.random()*0.008;
  trailPoints=[];
  planeX=36;planeY=aviH-50;

  const multEl=document.getElementById('aviMult');
  multEl.textContent='1.00x';
  multEl.className='avi-mult safe';
  multEl.style.fontSize='3rem';
  document.getElementById('aviMultLabel').textContent='FLYING...';

  var planEl=document.getElementById('aviPlane');
  if(planEl)planEl.classList.add('flying');

  setAviBadge('A','IN FLIGHT','rgba(255,158,11,.15)','rgba(255,158,11,.4)','#f5c04a');
  setAviBadge('B','IN FLIGHT','rgba(255,158,11,.15)','rgba(255,158,11,.4)','#f5c04a');
  document.getElementById('aviBetA').disabled=true;
  document.getElementById('aviBetB').disabled=true;

  if(!aviBetA.active){setAviBtnA('waiting','Bet Next Round');}
  else{setAviBtnA('cashout','CASH OUT Rs.'+(aviBetA.amount*1).toFixed(0)+' (x1.00)');setAviStatus('A','Live — cash out anytime!','abs-live');}

  if(!aviBetB.active){setAviBtnB('waiting','Bet Next Round');}
  else{setAviBtnB('cashout','CASH OUT Rs.'+(aviBetB.amount*1).toFixed(0)+' (x1.00)',true);setAviStatus('B','Live — cash out anytime!','abs-live');}

  var lastTs=0;
  function tick(ts){
    if(!lastTs)lastTs=ts;
    var dt=Math.min((ts-lastTs)/1000,0.05);
    lastTs=ts;

    aviMult+=aviMult*aviSpeed*dt*60;

    if(aviMult>=aviTarget){
      aviMult=aviTarget;
      aviCrash();
      return;
    }

    if(aviBetA.active&&!aviBetA.cashedOut&&aviBetA.auto&&aviMult>=aviBetA.autoVal)aviCashOut('A');
    if(aviBetB.active&&!aviBetB.cashedOut&&aviBetB.auto&&aviMult>=aviBetB.autoVal)aviCashOut('B');

    const m=aviMult.toFixed(2);
    const multEl=document.getElementById('aviMult');
    multEl.textContent=m+'x';

    if(aviMult<2)multEl.className='avi-mult safe';
    else if(aviMult<5)multEl.className='avi-mult mid';
    else multEl.className='avi-mult hot';

    if(aviBetA.active&&!aviBetA.cashedOut){
      const win=(aviBetA.amount*aviMult);
      document.getElementById('aviBtnA').textContent='CASH OUT  Rs.'+win.toFixed(0)+'  (x'+m+')';
    }
    if(aviBetB.active&&!aviBetB.cashedOut){
      const win=(aviBetB.amount*aviMult);
      document.getElementById('aviBtnB').textContent='CASH OUT  Rs.'+win.toFixed(0)+'  (x'+m+')';
    }

    var progress=Math.min((aviMult-1)/Math.max(aviTarget-1,1),1);
    planeX=36+(aviW-80)*progress;
    planeY=(aviH-50)-((aviH-80)*Math.pow(progress,0.7));

    var plane=document.getElementById('aviPlane');
    if(plane){
      plane.style.left=(planeX-48)+'px';
      plane.style.top=(planeY-32)+'px';
      var tilt=Math.max(-32,-32*progress);
      plane.style.transform='rotate('+tilt+'deg)';
    }

    trailPoints.push({x:planeX,y:planeY,m:aviMult});
    if(trailPoints.length>220)trailPoints.shift();

    aviDrawFlight(false);
    aviFrame=requestAnimationFrame(tick);
  }
  aviFrame=requestAnimationFrame(tick);
}

// ── Crash ─────────────────────────────────────
function aviCrash(){
  if(aviFrame)cancelAnimationFrame(aviFrame);
  aviState='crashed';
  var fm=aviMult.toFixed(2);

  document.getElementById('aviCrashOverlay').classList.add('show');
  var multEl=document.getElementById('aviMult');
  multEl.textContent=fm+'x';
  multEl.className='avi-mult danger';
  document.getElementById('aviMultLabel').textContent='FLEW AWAY!';

  var plane=document.getElementById('aviPlane');
  if(plane){
    plane.classList.remove('flying');
    plane.style.opacity='0';
    setTimeout(function(){plane.style.opacity='1';},5000);
  }

  aviDrawFlight(true);

  if(aviBetA.active&&!aviBetA.cashedOut){
    aviTotalLost+=aviBetA.amount;
    aviMyBetLog.unshift({round:aviRoundHistory.length+1,crashAt:parseFloat(fm),betAmt:aviBetA.amount,cashed:false,win:0,slot:'A'});
    setAviStatus('A','Lost Rs.'+aviBetA.amount+' — crashed at '+fm+'x','abs-lose');
    showToast('Flew away at '+fm+'x! Lost Rs.'+aviBetA.amount,'lose');
    addTx('lose','AVI-'+Date.now().toString().slice(-6),-aviBetA.amount);
  } else if(aviBetA.active&&aviBetA.cashedOut){
    aviMyBetLog.unshift({round:aviRoundHistory.length+1,crashAt:parseFloat(fm),betAmt:aviBetA.amount,cashed:true,cashMult:aviBetA.cashoutMult,win:aviBetA.amount*aviBetA.cashoutMult,slot:'A'});
  }

  if(aviBetB.active&&!aviBetB.cashedOut){
    aviTotalLost+=aviBetB.amount;
    aviMyBetLog.unshift({round:aviRoundHistory.length+1,crashAt:parseFloat(fm),betAmt:aviBetB.amount,cashed:false,win:0,slot:'B'});
    if(!aviBetA.active||aviBetA.cashedOut){
      setAviStatus('B','Lost Rs.'+aviBetB.amount+' — crashed at '+fm+'x','abs-lose');
      showToast('Bet 2 lost Rs.'+aviBetB.amount,'lose');
    }
    addTx('lose','AVI-B-'+Date.now().toString().slice(-6),-aviBetB.amount);
  } else if(aviBetB.active&&aviBetB.cashedOut){
    aviMyBetLog.unshift({round:aviRoundHistory.length+1,crashAt:parseFloat(fm),betAmt:aviBetB.amount,cashed:true,cashMult:aviBetB.cashoutMult,win:aviBetB.amount*aviBetB.cashoutMult,slot:'B'});
  }

  setAviBtnA('waiting','-');
  setAviBtnB('waiting','-');
  setAviBadge('A','CRASHED','rgba(255,68,68,.12)','rgba(255,68,68,.3)','#ff6b6b');
  setAviBadge('B','CRASHED','rgba(255,68,68,.12)','rgba(255,68,68,.3)','#ff6b6b');

  aviRoundHistory.unshift(parseFloat(fm));
  if(aviRoundHistory.length>20)aviRoundHistory.pop();
  renderAviHistory();

  var ri=document.getElementById('aviResultInfo');
  ri.style.display='block';
  var lm=document.getElementById('aviLastMult');
  lm.textContent=fm+'x';
  lm.style.color=aviMult<2?'#60aaff':aviMult<5?'#f5c04a':aviMult<10?'#a47cfc':'#ff7070';
  document.getElementById('aviLastMsg').textContent='Next round in 5 seconds...';

  liveChips.forEach(function(c){c.cashed=false;});renderFakeLive();

  aviUpdateStats();
  balance=aviBalance;showBal();
  renderAviMyBets();

  setTimeout(aviStartWaiting,5200);
}

// ── Cashout ───────────────────────────────────
function aviCashOut(slot){
  var bet=slot==='A'?aviBetA:aviBetB;
  if(!bet.active||bet.cashedOut||aviState!=='flying')return;
  bet.cashedOut=true;
  bet.cashoutMult=aviMult;
  var win=bet.amount*aviMult;
  var profit=win-bet.amount;
  aviBalance+=win;aviTotalWon+=win;
  showToast('Cashed out x'+aviMult.toFixed(2)+'! +Rs.'+profit.toFixed(0),'win');
  setAviStatus(slot,'Cashed x'+aviMult.toFixed(2)+' — Won Rs.'+win.toFixed(0),'abs-win');
  if(slot==='A')setAviBtnA('cashed-done','Cashed Out x'+aviMult.toFixed(2));
  else setAviBtnB('cashed-done','Cashed Out x'+aviMult.toFixed(2),true);
  addTx('win','AVI-'+slot+'-'+Date.now().toString().slice(-6),win);
  aviUpdateStats();balance=aviBalance;showBal();
}

// ── Place Bet ─────────────────────────────────
function aviBetAction(slot){
  var inpId=slot==='A'?'aviBetA':'aviBetB';
  var bet=slot==='A'?aviBetA:aviBetB;
  if(aviState!=='waiting'){showToast('Bets open only before the round!','lose');return;}
  if(bet.active){showToast('Bet '+slot+' already placed','info');return;}
  var amt=parseInt(document.getElementById(inpId).value);
  if(!amt||amt<10){showToast('Min bet Rs.10','lose');return;}
  if(amt>aviBalance){showToast('Insufficient balance!','lose');return;}
  bet.active=true;bet.amount=amt;bet.cashedOut=false;
  aviBalance-=amt;aviUpdateStats();balance=aviBalance;showBal();
  if(slot==='A'){
    setAviBtnA('waiting','Bet Rs.'+amt+' placed');
    setAviBadge('A','BET PLACED','rgba(79,200,122,.15)','rgba(79,200,122,.5)','#4fc87a');
    setAviStatus('A','Rs.'+amt+' placed — waiting for round to start','abs-waiting');
  } else {
    setAviBtnB('waiting','Bet 2: Rs.'+amt+' placed',true);
    setAviBadge('B','BET PLACED','rgba(58,142,246,.15)','rgba(58,142,246,.5)','#60aaff');
    setAviStatus('B','Rs.'+amt+' placed — waiting for round to start','abs-waiting');
  }
  showToast('Bet '+slot+': Rs.'+amt+' placed!','info');
}

// ── Draw functions ────────────────────────────
function aviDrawIdle(){
  if(!aviCtx)return;
  aviCtx.clearRect(0,0,aviW,aviH);
  drawBg();
  var plane=document.getElementById('aviPlane');
  if(plane){
    plane.classList.remove('flying');
    plane.style.opacity='1';
    plane.style.left=(36-48)+'px';
    plane.style.top=(aviH-50-32)+'px';
    plane.style.transform='rotate(0deg)';
  }
}

function aviDrawFlight(crashed){
  if(!aviCtx)return;
  aviCtx.clearRect(0,0,aviW,aviH);
  drawBg();

  if(trailPoints.length>1){
    var col=crashed?'rgba(248,81,73,0.95)':'rgba(124,92,252,0.95)';
    var glowCol=crashed?'rgba(232,68,90,0.9)':'rgba(124,92,252,0.9)';

    aviCtx.save();
    var grad=aviCtx.createLinearGradient(0,aviH*0.1,0,aviH);
    grad.addColorStop(0,crashed?'rgba(248,81,73,0.22)':'rgba(99,120,220,0.22)');
    grad.addColorStop(0.7,'rgba(0,0,0,0)');
    aviCtx.fillStyle=grad;
    aviCtx.beginPath();
    aviCtx.moveTo(trailPoints[0].x,aviH-22);
    for(var i=0;i<trailPoints.length;i++){
      aviCtx.lineTo(trailPoints[i].x,trailPoints[i].y);
    }
    aviCtx.lineTo(trailPoints[trailPoints.length-1].x,aviH-22);
    aviCtx.closePath();aviCtx.fill();aviCtx.restore();

    aviCtx.save();
    aviCtx.shadowBlur=20;aviCtx.shadowColor=glowCol;
    aviCtx.strokeStyle=col;aviCtx.lineWidth=4;
    aviCtx.lineCap='round';aviCtx.lineJoin='round';
    aviCtx.beginPath();
    aviCtx.moveTo(trailPoints[0].x,trailPoints[0].y);
    for(var j=1;j<trailPoints.length;j++){
      aviCtx.lineTo(trailPoints[j].x,trailPoints[j].y);
    }
    aviCtx.stroke();aviCtx.restore();

    aviCtx.save();
    aviCtx.strokeStyle=crashed?'rgba(255,160,160,0.9)':'rgba(196,181,255,0.85)';
    aviCtx.lineWidth=1.5;
    aviCtx.lineCap='round';aviCtx.lineJoin='round';
    aviCtx.beginPath();
    aviCtx.moveTo(trailPoints[0].x,trailPoints[0].y);
    for(var k=1;k<trailPoints.length;k++){
      aviCtx.lineTo(trailPoints[k].x,trailPoints[k].y);
    }
    aviCtx.stroke();aviCtx.restore();

    if(!crashed){
      var last=trailPoints[trailPoints.length-1];
      aviCtx.save();
      aviCtx.shadowBlur=24;aviCtx.shadowColor='rgba(124,92,252,1)';
      aviCtx.fillStyle='rgba(196,181,255,0.95)';
      aviCtx.beginPath();aviCtx.arc(last.x,last.y,4,0,Math.PI*2);aviCtx.fill();
      aviCtx.restore();
    }
  }
}

function drawBg(){
  var skyGrad=aviCtx.createLinearGradient(0,0,0,aviH);
  skyGrad.addColorStop(0,'#1a1e3a');
  skyGrad.addColorStop(0.5,'#242b52');
  skyGrad.addColorStop(1,'#2e3668');
  aviCtx.fillStyle=skyGrad;
  aviCtx.fillRect(0,0,aviW,aviH);

  aviCtx.fillStyle='rgba(124,92,252,0.07)';
  for(var gx=0;gx<aviW;gx+=28){
    for(var gy=0;gy<aviH;gy+=28){
      aviCtx.beginPath();aviCtx.arc(gx,gy,1,0,Math.PI*2);aviCtx.fill();
    }
  }

  aviCtx.strokeStyle='rgba(124,92,252,0.07)';aviCtx.lineWidth=1;
  for(var x=0;x<aviW;x+=aviW/8){aviCtx.beginPath();aviCtx.moveTo(x,0);aviCtx.lineTo(x,aviH);aviCtx.stroke();}
  for(var y=0;y<aviH;y+=aviH/5){aviCtx.beginPath();aviCtx.moveTo(0,y);aviCtx.lineTo(aviW,y);aviCtx.stroke();}

  var starData=[[55,28,1.5],[118,68,1],[198,18,1.5],[298,48,1],[375,28,1],[98,118,1],[248,108,1.5],[418,78,1],[348,138,1],[162,44,1],[428,148,1],[82,88,1.5],[220,160,1],[340,55,1],[460,100,1],[190,85,1],[310,20,1.5],[440,55,1]];
  starData.forEach(function(s){
    aviCtx.fillStyle='rgba(200,210,255,'+( s[2]>1?'0.9':'0.6')+')';
    aviCtx.beginPath();aviCtx.arc(s[0],s[1],s[2],0,Math.PI*2);aviCtx.fill();
  });

  aviCtx.strokeStyle='rgba(124,92,252,0.25)';aviCtx.lineWidth=1.5;
  aviCtx.beginPath();aviCtx.moveTo(30,8);aviCtx.lineTo(30,aviH-20);aviCtx.lineTo(aviW-8,aviH-20);aviCtx.stroke();

  aviCtx.fillStyle='rgba(180,190,255,0.3)';aviCtx.font='bold 10px Orbitron,monospace';
  for(var yi=1;yi<=4;yi++){
    var yp=aviH-20-(aviH-40)*(yi/5);
    aviCtx.fillText(yi+'x',4,yp+4);
  }
}

function generateCrashPoint(){
  var r=Math.random();
  if(r<0.40)return 1.00+Math.random()*0.78;
  if(r<0.65)return 1.78+Math.random()*1.4;
  if(r<0.82)return 3.2+Math.random()*3.5;
  if(r<0.92)return 6.7+Math.random()*8;
  if(r<0.97)return 14.7+Math.random()*35;
  if(r<0.995)return 50+Math.random()*150;
  return 200+Math.random()*800;
}

function setAviBtnA(mode,label){
  var btn=document.getElementById('aviBtnA');
  if(!btn)return;
  btn.textContent=label;
  btn.className='avi-bet-btn '+mode;
  btn.disabled=(mode==='waiting'||mode==='cashed-done');
  if(mode==='cashout')btn.onclick=function(){aviCashOut('A');};
  else if(mode==='place')btn.onclick=function(){aviBetAction('A');};
  else btn.onclick=null;
}

function setAviBtnB(mode,label,isB){
  var btn=document.getElementById('aviBtnB');
  if(!btn)return;
  btn.textContent=label;
  var extraCls='';
  if(mode==='place')extraCls='style="background:linear-gradient(135deg,#3a8ef6,#6c63ff);"';
  btn.className='avi-bet-btn '+mode;
  if(mode==='cashout')btn.style.background='linear-gradient(135deg,#ff6b35,#e8445a)';
  else if(mode==='place')btn.style.background='linear-gradient(135deg,#3a8ef6,#6c63ff)';
  else btn.style.background='';
  btn.disabled=(mode==='waiting'||mode==='cashed-done');
  if(mode==='cashout')btn.onclick=function(){aviCashOut('B');};
  else if(mode==='place')btn.onclick=function(){aviBetAction('B');};
  else btn.onclick=null;
}

function setAviBadge(slot,text,bg,border,color){
  var el=document.getElementById('aviBadge'+slot);
  if(!el)return;
  el.textContent=text;
  el.style.background=bg;el.style.borderColor=border;el.style.color=color;
}

function setAviStatus(slot,msg,cls){
  var el=document.getElementById('aviStatus'+slot);
  if(!el)return;
  el.textContent=msg;
  el.className='avi-bet-status '+(cls||'abs-empty');
}

function toggleAutoA(){
  var chk=document.getElementById('aviAutoA');
  var inp=document.getElementById('aviAutoValA');
  aviBetA.auto=chk.checked;inp.disabled=!chk.checked;
  aviBetA.autoVal=parseFloat(inp.value)||2.0;
  inp.oninput=function(){aviBetA.autoVal=parseFloat(inp.value)||2.0;};
}
function toggleAutoB(){
  var chk=document.getElementById('aviAutoB');
  var inp=document.getElementById('aviAutoValB');
  aviBetB.auto=chk.checked;inp.disabled=!chk.checked;
  aviBetB.autoVal=parseFloat(inp.value)||5.0;
  inp.oninput=function(){aviBetB.autoVal=parseFloat(inp.value)||5.0;};
}

function aviSB(id,v){document.getElementById(id).value=v;}
function aviDbl(id){var v=parseInt(document.getElementById(id).value)||100;document.getElementById(id).value=Math.min(v*2,aviBalance);}
function aviHlf(id){var v=parseInt(document.getElementById(id).value)||100;document.getElementById(id).value=Math.max(Math.floor(v/2),10);}

function generateFakeLive(){
  liveChips=[];
  var count=6+Math.floor(Math.random()*7);
  for(var i=0;i<count;i++){
    var name=fakePlayers[Math.floor(Math.random()*fakePlayers.length)];
    var amts=[10,20,50,100,200,500,1000];
    var amt=amts[Math.floor(Math.random()*amts.length)];
    var willCash=Math.random()>0.32;
    var cashMult=1.15+Math.random()*9;
    liveChips.push({name:name,amt:amt,willCash:willCash,cashMult:cashMult,cashed:false,crashed:false});
  }
}
function renderFakeLive(){
  var bar=document.getElementById('aviLiveBar');
  if(!bar)return;
  var chips=liveChips.map(function(c){
    var cls='avi-live-chip';var txt=c.name+' Rs.'+c.amt;
    if(c.cashed&&c.willCash){cls+=' cashed';txt+=' @ x'+c.cashMult.toFixed(2);}
    else if(c.crashed){cls+=' crashed';}
    return '<div class="'+cls+'">'+txt+'</div>';
  }).join('');
  var extra=Math.floor(Math.random()*80+30);
  bar.innerHTML=chips+'<div class="avi-live-chip" style="opacity:.3;flex-shrink:0">+'+extra+' playing</div>';
}
setInterval(function(){
  if(aviState!=='flying')return;
  var changed=false;
  liveChips.forEach(function(c){
    if(!c.cashed&&!c.crashed&&c.willCash&&aviMult>=c.cashMult){c.cashed=true;changed=true;}
  });
  if(changed)renderFakeLive();
},700);

function renderAviHistory(){
  var el=document.getElementById('aviHistory');
  if(!el||!aviRoundHistory.length)return;
  el.innerHTML=aviRoundHistory.map(function(m){
    var cls='ahc-low';
    if(m>=50)cls='ahc-moon';
    else if(m>=10)cls='ahc-high';
    else if(m>=2)cls='ahc-mid';
    return '<div class="avi-hist-chip '+cls+'" title="Crashed at '+m.toFixed(2)+'x">'+m.toFixed(2)+'x</div>';
  }).join('');
  el.scrollLeft=0;
}

function renderAviMyBets(){
  var el=document.getElementById('aviMyBets');
  if(!el)return;
  if(!aviMyBetLog.length){
    el.innerHTML='<div style="text-align:center;color:rgba(255,255,255,.25);font-size:.78rem;padding:12px 0;">No bets yet this session</div>';
    return;
  }
  el.innerHTML='<table style="width:100%;border-collapse:collapse;">'
    +'<thead><tr>'
    +'<th style="font-size:.6rem;letter-spacing:1px;text-transform:uppercase;color:var(--muted);font-weight:700;padding:6px 4px;text-align:left;">Round</th>'
    +'<th style="font-size:.6rem;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.3);font-weight:700;padding:6px 4px;text-align:left;">Bet</th>'
    +'<th style="font-size:.6rem;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.3);font-weight:700;padding:6px 4px;text-align:left;">Crash</th>'
    +'<th style="font-size:.6rem;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.3);font-weight:700;padding:6px 4px;text-align:right;">Result</th>'
    +'</tr></thead><tbody>'
    +aviMyBetLog.slice(0,10).map(function(b){
      var resultTxt,resultColor;
      if(b.cashed){
        var profit=b.win-b.betAmt;
        resultTxt=(profit>=0?'+':'')+profit.toFixed(0)+' (x'+b.cashMult.toFixed(2)+')';
        resultColor='#4fc87a';
      } else {
        resultTxt='-Rs.'+b.betAmt;
        resultColor='#ff6b6b';
      }
      return '<tr style="border-bottom:1px solid var(--border);">'
        +'<td style="padding:9px 4px;font-family:monospace;font-size:.72rem;color:var(--muted);">#'+b.round+'</td>'
        +'<td style="padding:9px 4px;font-size:.78rem;color:var(--text2);font-weight:600;">Rs.'+b.betAmt+(b.slot==='B'?' (2)':'')+'</td>'
        +'<td style="padding:9px 4px;font-family:monospace;font-size:.76rem;color:'+(b.crashAt<2?'#60aaff':b.crashAt<5?'#f5c04a':'#ff7070')+';">'+b.crashAt.toFixed(2)+'x</td>'
        +'<td style="padding:9px 4px;font-weight:800;font-size:.82rem;color:'+resultColor+';text-align:right;">'+resultTxt+'</td>'
        +'</tr>';
    }).join('')
    +'</tbody></table>';
}

// ═══════════════════════════════════════════════
// LUDO KING — ENGINE 
// ═══════════════════════════════════════════════
var DICE_EMOJI=['⚀','⚁','⚂','⚃','⚄','⚅'];
var BOT_NAMES=['Raj_Pro','Priya_G','Amit_K','Sunita_R','Vikram_S','Neha_M'];
var PC=[
  {s:'#c62828',t:'#ef5350',b:'#8e0000',l:'#ffcdd2',m:'#ef9a9a'},
  {s:'#2e7d32',t:'#66bb6a',b:'#1b5e20',l:'#c8e6c9',m:'#a5d6a7'},
  {s:'#f9a825',t:'#ffee58',b:'#c17900',l:'#fff9c4',m:'#fff59d'},
  {s:'#0277bd',t:'#4fc3f7',b:'#004c8c',l:'#bbdefb',m:'#90caf9'}
];

var OUTER=[
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  [14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7]
]; 

var HOME=[
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],        
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],         
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],     
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]      
];

var START=[1,14,40,27];
var SAFE=[1,9,14,22,27,35,40,48];
var HOME_POS=[
  [[1.75,1.75],[4.25,1.75],[1.75,4.25],[4.25,4.25]],
  [[10.75,1.75],[13.25,1.75],[10.75,4.25],[13.25,4.25]],
  [[1.75,10.75],[4.25,10.75],[1.75,13.25],[4.25,13.25]],
  [[10.75,10.75],[13.25,10.75],[10.75,13.25],[13.25,13.25]]
];

var LG={betAmt:100,selectedBet:null,state:'lobby',players:[],curPlayer:0,
        diceVal:0,myTurn:false,moveReady:false,moveTimer:null,botTimer:null,
        canvas:null,ctx:null,sz:0,wins:0,losses:0};
var ANM={on:false,pi:0,ti:0,steps:[],cur:0,timer:null,DELAY:160};

function ludoSyncBalance(){
  var el=document.getElementById('ludoBalAmt');
  if(el) el.textContent='₹'+balance.toLocaleString('en-IN',{minimumFractionDigits:2});
}

function ludoInit(){
  ludoShow('lobby');
  ludoRenderRooms();
  ludoSyncBalance();
  LG.state='lobby';
}

function ludoShow(s){
  ['lobby','matching','game','win'].forEach(function(n){
    var el=document.getElementById('ludo-'+n);
    if(el) el.style.display=(n===s)?'block':'none';
  });
}

function ludoSelectBet(amt,el){
  if(amt>balance){showToast('Insufficient balance!','lose');return;}
  LG.betAmt=amt;LG.selectedBet=amt;
  document.querySelectorAll('.ld-bet-pill').forEach(function(c){c.classList.remove('sel');});
  el.classList.add('sel');
}

function ludoRenderRooms(){
  var rooms=[
    {n:'Quick Duel',bet:50,w:4,ico:'⚡',bg:'#fef9c3',bc:'#f59e0b'},
    {n:'Classic Match',bet:100,w:7,ico:'🏆',bg:'#f3e8ff',bc:'#7c3aed'},
    {n:'Premium',bet:500,w:3,ico:'💎',bg:'#e0e7ff',bc:'#4f46e5'},
    {n:'High Roller',bet:1000,w:1,ico:'👑',bg:'#ffe4e6',bc:'#ef4444'}
  ];
  var el=document.getElementById('ludoRoomList');if(!el)return;
  el.innerHTML=rooms.map(function(r){
    var prize=Math.floor(r.bet*2*.9);
    return '<div class="ld-room" onclick="ludoJoinRoom('+r.bet+')">'
      +'<div class="ld-room-ico" style="background:'+r.bg+';border-color:'+r.bc+'">'+r.ico+'</div>'
      +'<div style="flex:1"><div class="ld-room-nm">'+r.n+'</div>'
      +'<div class="ld-room-meta">Bet ₹'+r.bet+' · '+r.w+' waiting</div></div>'
      +'<div class="ld-room-prize"><div class="ld-room-pamt">₹'+prize+'</div>'
      +'<div class="ld-room-plbl">Prize</div></div></div>';
  }).join('');
}

function ludoJoinRoom(bet){
  LG.betAmt=bet;LG.selectedBet=bet;
  document.querySelectorAll('.ld-bet-pill').forEach(function(c,i){
    c.classList.toggle('sel',[50,100,250,500,1000,2000][i]===bet);
  });
  ludoFindMatch();
}

function ludoFindMatch(){
  var bet=LG.betAmt||100;
  if(bet>balance){showToast('Insufficient balance!','lose');return;}
  if(!LG.selectedBet) LG.selectedBet=bet;
  balance-=bet;showBal();ludoSyncBalance();
  LG.state='matching';ludoShow('matching');
  var eMB=document.getElementById('ludoMatchBet');if(eMB) eMB.textContent=bet;
  var myName=(currentUser&&currentUser.name)?currentUser.name.split(' ')[0]:'You';
  var botName=BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)];
  ldRenderSlots(myName,null);
  var eMS=document.getElementById('ludoMatchStatus');if(eMS) eMS.textContent='Scanning rooms…';
  setTimeout(function(){
    if(LG.state!=='matching') return;
    ldRenderSlots(myName,botName);
    var eMS2=document.getElementById('ludoMatchStatus');if(eMS2) eMS2.textContent='Opponent found! Loading board…';
    setTimeout(function(){if(LG.state==='matching') ludoStartGame(bet,myName,botName);},1200);
  },1500+Math.floor(Math.random()*1500));
}

function ludoCancelMatch(){
  LG.state='lobby';balance+=LG.betAmt;showBal();ludoSyncBalance();
  ludoShow('lobby');showToast('Cancelled. Refunded.','info');
}

function ldRenderSlots(p1,p2){
  var slots=[{name:p1,ci:0},{name:p2,ci:2}];
  var html='';
  slots.forEach(function(p,i){
    var f=!!p.name;
    html+='<div class="ld-slot">'
      +'<div class="ld-slot-av '+(f?'found':'empty')+'" style="background:'+(f?PC[p.ci].l:'#f9fafb')
      +';border-color:'+(f?PC[p.ci].s:'#e5e7eb')+';color:'+(f?PC[p.ci].s:'#9ca3af')+';">'
      +(f?p.name.charAt(0).toUpperCase():'?')+'</div>'
      +'<div class="ld-slot-nm">'+(f?p.name:'Searching...')+'</div></div>';
    if(i===0) html+='<div class="ld-vs">VS</div>';
  });
  var el=document.getElementById('ludoPlayersRow');if(el) el.innerHTML=html;
}

function ludoStartGame(bet,myName,botName){
  ldClearTimers();
  LG.state='playing';LG.betAmt=bet;
  LG.curPlayer=0;LG.diceVal=0;LG.myTurn=true;LG.moveReady=false;

  LG.players=[
    {name:myName, ci:0, isBot:false, tokens:[{pos:-1},{pos:-1},{pos:-1},{pos:-1}], done:0},
    {name:botName,ci:2, isBot:true,  tokens:[{pos:-1},{pos:-1},{pos:-1},{pos:-1}], done:0}
  ];

  var pot=bet*2;
  var e1=document.getElementById('ludoPotAmt');if(e1) e1.textContent=pot.toLocaleString('en-IN');
  var e2=document.getElementById('ludoRoundLabel');if(e2) e2.textContent='2 PLAYERS · BET ₹'+bet;
  ldHideDiceDisplay();

  ludoShow('game');
  setTimeout(function(){
    ldInitCanvas();
    ldUpdateStrips();
    ldSetTurnUI();
    var lg=document.getElementById('ludoLog');if(lg) lg.innerHTML='';
    ldLog('🎮 Game started! Pot ₹'+pot+' → Winner gets ₹'+Math.floor(pot*.9));
  },200);
}

function ldClearTimers(){
  if(LG.moveTimer){clearTimeout(LG.moveTimer);LG.moveTimer=null;}
  if(LG.botTimer){clearTimeout(LG.botTimer);LG.botTimer=null;}
  ANM.on=false;
  if(ANM.timer){clearTimeout(ANM.timer);ANM.timer=null;}
}

function ldInitCanvas(){
  var canvas=document.getElementById('ludoCanvas');if(!canvas) return;
  LG.canvas=canvas;
  ldResizeCanvas();
  LG.ctx=canvas.getContext('2d');
  ldDraw();

  function getCanvasPos(e){
    var rect=canvas.getBoundingClientRect();
    var scaleX=canvas.width/rect.width;
    var scaleY=canvas.height/rect.height;
    var src=e.touches?e.touches[0]:e;
    return {x:(src.clientX-rect.left)*scaleX, y:(src.clientY-rect.top)*scaleY};
  }
  canvas.onclick=function(e){
    if(!LG.myTurn||LG.diceVal===0||LG.moveReady||ANM.on) return;
    var pos=getCanvasPos(e);
    ldClickToken(pos.x,pos.y);
  };
  canvas.ontouchend=function(e){
    if(!LG.myTurn||LG.diceVal===0||LG.moveReady||ANM.on) return;
    e.preventDefault();
    var pos=getCanvasPos(e.changedTouches[0]?{touches:e.changedTouches}:e);
    ldClickToken(pos.x,pos.y);
  };

  (function pulse(){
    if(LG.state==='playing'){
      if(LG.myTurn&&LG.diceVal>0&&!LG.moveReady&&!ANM.on) ldDraw();
    }
    requestAnimationFrame(pulse);
  })();
}

function ldResizeCanvas(){
  if(!LG.canvas) return;
  var parent=LG.canvas.parentElement;
  var w=Math.max(parent.offsetWidth-8,280);
  LG.canvas.width=w;LG.canvas.height=w;LG.sz=w;
}

window.addEventListener('resize',function(){
  if(LG.state==='playing'&&LG.canvas){
    ldResizeCanvas();ldDraw();
  }
});

function ldDraw(){
  var ctx=LG.ctx;if(!ctx) return;
  var S=LG.sz||280, cs=S/15;

  ctx.clearRect(0,0,S,S);

  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.25)';ctx.shadowBlur=12;ctx.shadowOffsetY=3;
  ctx.fillStyle='#b8b8b8';
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(0,0,S,S,6); else ctx.rect(0,0,S,S);
  ctx.fill();
  ctx.restore();

  for(var r=0;r<15;r++) for(var c=0;c<15;c++) ldDrawCell(ctx,cs,c,r);

  ldDrawHomeZone(ctx,cs, 0, 0,'#c62828'); 
  ldDrawHomeZone(ctx,cs, 9, 0,'#2e7d32'); 
  ldDrawHomeZone(ctx,cs, 0, 9,'#f9a825'); 
  ldDrawHomeZone(ctx,cs, 9, 9,'#0277bd'); 

  ldDrawCenterStar(ctx,cs);

  ctx.strokeStyle='rgba(0,0,0,0.10)';ctx.lineWidth=0.6;
  for(var i=0;i<=15;i++){
    ctx.beginPath();ctx.moveTo(i*cs,0);ctx.lineTo(i*cs,S);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i*cs);ctx.lineTo(S,i*cs);ctx.stroke();
  }

  ctx.strokeStyle='rgba(0,0,0,0.45)';ctx.lineWidth=3.5;
  ctx.strokeRect(1.5,1.5,S-3,S-3);

  ctx.strokeStyle='rgba(0,0,0,0.28)';ctx.lineWidth=2;
  ctx.strokeRect(0,0,6*cs,6*cs);ctx.strokeRect(9*cs,0,6*cs,6*cs);
  ctx.strokeRect(0,9*cs,6*cs,6*cs);ctx.strokeRect(9*cs,9*cs,6*cs,6*cs);

  SAFE.forEach(function(idx){
    var cell=OUTER[idx];
    if(ldInQuad(cell[0],cell[1])) return;
    var x=cell[0]*cs, y=cell[1]*cs;
    ctx.fillStyle='rgba(110,50,200,0.10)';
    ctx.fillRect(x+1,y+1,cs-2,cs-2);
    ctx.font='bold '+Math.max(Math.floor(cs*.5),6)+'px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(90,30,180,0.50)';
    ctx.fillText('★',x+cs/2,y+cs/2);
  });

  if(LG.players.length){
    LG.players.forEach(function(p,pi){
      var entryCell=OUTER[START[p.ci]];
      if(ldInQuad(entryCell[0],entryCell[1])) return;
      var x=entryCell[0]*cs, y=entryCell[1]*cs;
      ctx.fillStyle=PC[p.ci].s+'22';ctx.fillRect(x+1,y+1,cs-2,cs-2);
      ctx.font='bold '+Math.max(Math.floor(cs*.48),5)+'px sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle=PC[p.ci].s+'dd';
      var arrows=['▶','▽','◀','△'];
      ctx.fillText(arrows[p.ci],x+cs/2,y+cs/2);
    });
  }

  LG.players.forEach(function(p,pi){
    p.tokens.forEach(function(tok,ti){
      var isAnim=(ANM.on&&ANM.pi===pi&&ANM.ti===ti);
      if(tok.pos===-1&&!isAnim){
        var hp=HOME_POS[p.ci][ti];
        ldDrawMarble(ctx, hp[0]*cs, hp[1]*cs, Math.max(cs*.38,5), p.ci, false);
      }
    });
  });

  LG.players.forEach(function(p,pi){
    p.tokens.forEach(function(tok,ti){
      var isAnim=(ANM.on&&ANM.pi===pi&&ANM.ti===ti);
      if(isAnim) return;
      if(tok.pos>=0&&tok.pos<=56){
        var xy=ldPosToXY(tok.pos,p.ci,cs);
        if(xy) ldDrawMarble(ctx,xy.x,xy.y,Math.max(cs*.35,4),p.ci,false);
      }
      if(tok.pos===57){
        var cen=7.5*cs;
        var off=[[-1,-1],[1,-1],[-1,1],[1,1]][ti];
        ldDrawMarble(ctx,cen+off[0]*cs*.26,cen+off[1]*cs*.26,Math.max(cs*.2,3),p.ci,true);
      }
    });
  });

  if(ANM.on&&ANM.cur<ANM.steps.length&&LG.players[ANM.pi]){
    var ap=ANM.steps[ANM.cur];
    var axy;
    if(ap===-1){
      var hp2=HOME_POS[LG.players[ANM.pi].ci][ANM.ti];
      axy={x:hp2[0]*cs, y:hp2[1]*cs};
    } else {
      axy=ldPosToXY(ap,LG.players[ANM.pi].ci,cs);
    }
    if(axy){
      ctx.beginPath();ctx.arc(axy.x,axy.y+4,Math.max(cs*.36,5),0,Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.20)';ctx.fill();
      ctx.beginPath();ctx.arc(axy.x,axy.y,Math.max(cs*.48,6),0,Math.PI*2);
      ctx.strokeStyle='rgba(255,215,0,0.92)';ctx.lineWidth=3.5;ctx.setLineDash([]);ctx.stroke();
      ldDrawMarble(ctx,axy.x,axy.y,Math.max(cs*.35,4),LG.players[ANM.pi].ci,false);
    }
  }

  if(LG.myTurn&&LG.diceVal>0&&!LG.moveReady&&!ANM.on){
    var t=Date.now()/350;
    var pulse=0.55+0.45*Math.sin(t);
    ldGetMovable(0,LG.diceVal).forEach(function(ti){
      var tok2=LG.players[0].tokens[ti];
      var mxy;
      if(tok2.pos===-1){var h2=HOME_POS[0][ti];mxy={x:h2[0]*cs,y:h2[1]*cs};}
      else mxy=ldPosToXY(tok2.pos,0,cs);
      if(!mxy) return;
      ctx.beginPath();ctx.arc(mxy.x,mxy.y,Math.max(cs*.5,7),0,Math.PI*2);
      ctx.strokeStyle='rgba(255,230,0,'+pulse+')';ctx.lineWidth=3;ctx.setLineDash([]);ctx.stroke();
      ctx.beginPath();ctx.arc(mxy.x,mxy.y,Math.max(cs*.68,9),0,Math.PI*2);
      ctx.strokeStyle='rgba(255,230,0,'+(pulse*.3)+')';ctx.lineWidth=2;ctx.stroke();
    });
  }
}

function ldDrawCell(ctx,cs,c,r){
  var x=c*cs, y=r*cs;
  ctx.fillStyle='#ffffff';
  ctx.fillRect(x,y,cs,cs);

  if(c<=5&&r<=5){ctx.fillStyle='#c62828';ctx.fillRect(x,y,cs,cs);return;}
  if(c>=9&&r<=5){ctx.fillStyle='#2e7d32';ctx.fillRect(x,y,cs,cs);return;}
  if(c<=5&&r>=9){ctx.fillStyle='#f9a825';ctx.fillRect(x,y,cs,cs);return;}
  if(c>=9&&r>=9){ctx.fillStyle='#0277bd';ctx.fillRect(x,y,cs,cs);return;}

  if(r===7&&c>=1&&c<=5){ctx.fillStyle='#ffb3b3';ctx.fillRect(x,y,cs,cs);return;}
  if(c===7&&r>=1&&r<=5){ctx.fillStyle='#b3e6b3';ctx.fillRect(x,y,cs,cs);return;}
  if(c===7&&r>=9&&r<=13){ctx.fillStyle='#fff0a8';ctx.fillRect(x,y,cs,cs);return;}
  if(r===7&&c>=9&&c<=13){ctx.fillStyle='#b6ddff';ctx.fillRect(x,y,cs,cs);return;}

  if((r===6||r===8)&&(c<=5||c>=9)){ctx.fillStyle='#ffffff';ctx.fillRect(x,y,cs,cs);return;}
  if((c===6||c===8)&&(r<=5||r>=9)){ctx.fillStyle='#ffffff';ctx.fillRect(x,y,cs,cs);return;}

  if((c>=6&&c<=8)||(r>=6&&r<=8)){
    ctx.fillStyle='#f8fafc';
    ctx.fillRect(x,y,cs,cs);
  }
}

function ldDrawHomeZone(ctx,cs,sx,sy,color){
  var px=sx*cs, py=sy*cs, size=6*cs;
  var boxX=px+cs*.72, boxY=py+cs*.72, boxS=size-cs*1.44;

  ctx.save();
  ctx.fillStyle='rgba(255,255,255,0.94)';
  ctx.fillRect(boxX,boxY,boxS,boxS);
  ctx.globalAlpha=.18;
  ctx.fillStyle=color;
  ctx.fillRect(boxX,boxY,boxS,boxS);
  ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(255,255,255,0.82)';
  ctx.lineWidth=Math.max(cs*.18,2);
  ctx.strokeRect(boxX,boxY,boxS,boxS);

  [
    [sx+1.75,sy+1.75],
    [sx+4.25,sy+1.75],
    [sx+1.75,sy+4.25],
    [sx+4.25,sy+4.25]
  ].forEach(function(p){
    ctx.beginPath();
    ctx.arc(p[0]*cs,p[1]*cs,Math.max(cs*.48,7),0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.strokeStyle=color;
    ctx.lineWidth=Math.max(cs*.12,1.5);
    ctx.stroke();
  });
  ctx.restore();
}

function ldDrawCenterStar(ctx,cs){
  var left=6*cs, top=6*cs, right=9*cs, bottom=9*cs, mid=7.5*cs;

  function tri(a,b,c,color){
    ctx.beginPath();
    ctx.moveTo(a[0],a[1]);
    ctx.lineTo(b[0],b[1]);
    ctx.lineTo(c[0],c[1]);
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
  }

  tri([left,top],[right,top],[mid,mid],'#2e7d32');
  tri([right,top],[right,bottom],[mid,mid],'#0277bd');
  tri([right,bottom],[left,bottom],[mid,mid],'#f9a825');
  tri([left,bottom],[left,top],[mid,mid],'#c62828');

  ctx.beginPath();
  ctx.arc(mid,mid,Math.max(cs*.62,8),0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.14)';
  ctx.lineWidth=Math.max(cs*.1,1.2);
  ctx.stroke();
}

function ldInQuad(c,r){
  return (c<=5&&r<=5)||(c>=9&&r<=5)||(c<=5&&r>=9)||(c>=9&&r>=9);
}

function ldDrawMarble(ctx,x,y,r,ci,done){
  var pal=PC[ci]||PC[0];
  var grad=ctx.createRadialGradient(x-r*.3,y-r*.35,r*.15,x,y,r);

  grad.addColorStop(0,'#ffffff');
  grad.addColorStop(.28,pal.t);
  grad.addColorStop(1,pal.s);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x,y+r*.18,r*1.02,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.18)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle=grad;
  ctx.fill();
  ctx.lineWidth=Math.max(r*.2,1.5);
  ctx.strokeStyle=pal.b;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x-r*.28,y-r*.28,r*.34,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.42)';
  ctx.fill();

  if(done){
    ctx.beginPath();
    ctx.arc(x,y,r*1.22,0,Math.PI*2);
    ctx.lineWidth=Math.max(r*.16,1.6);
    ctx.strokeStyle='rgba(255,215,0,0.95)';
    ctx.stroke();
  }
  ctx.restore();
}

function ldPosToXY(pos,ci,cs){
  if(pos<0) return null;
  if(pos<=51){
    var cell=OUTER[(START[ci]+pos)%OUTER.length];
    return {x:(cell[0]+.5)*cs,y:(cell[1]+.5)*cs};
  }
  if(pos<=56){
    var hp=HOME[ci][pos-52];
    return hp?{x:(hp[0]+.5)*cs,y:(hp[1]+.5)*cs}:null;
  }
  if(pos===57) return {x:7.5*cs,y:7.5*cs};
  return null;
}

function ldHideDiceDisplay(){
  var wrap=document.getElementById('ludoDiceDisplay');
  var num=document.getElementById('ludoDiceNum');
  var badge=document.getElementById('ludoDiceBigSmall');
  var result=document.getElementById('ludoDiceResult');

  if(wrap) wrap.style.display='none';
  if(num) num.textContent='';
  if(badge){badge.className='ld-bs-big';badge.textContent='BIG';}
  if(result) result.textContent='';
}

function ldShowDiceDisplay(dice){
  var wrap=document.getElementById('ludoDiceDisplay');
  var num=document.getElementById('ludoDiceNum');
  var badge=document.getElementById('ludoDiceBigSmall');

  if(wrap) wrap.style.display='flex';
  if(num) num.textContent=String(dice);
  if(!badge) return;

  if(dice===6){
    badge.className='ld-bs-six';
    badge.textContent='SIX';
  }else if(dice>=4){
    badge.className='ld-bs-big';
    badge.textContent='BIG';
  }else{
    badge.className='ld-bs-small';
    badge.textContent='SMALL';
  }
}

function ldCountDone(pi){
  var p=LG.players[pi];
  if(!p) return 0;
  return p.tokens.filter(function(tok){return tok.pos===57;}).length;
}

function ldGlobalCell(pos,ci){
  if(pos<0||pos>51) return -1;
  return (START[ci]+pos)%OUTER.length;
}

function ldPreviewMove(tok,dice){
  if(tok.pos===57) return null;
  if(tok.pos===-1) return dice===6?0:null;
  return tok.pos+dice<=57?tok.pos+dice:null;
}

function ldWillCapture(pi,newPos){
  var p=LG.players[pi];
  if(!p||newPos===null||newPos<0||newPos>51) return false;

  var g=ldGlobalCell(newPos,p.ci);
  if(SAFE.indexOf(g)!==-1) return false;

  return LG.players.some(function(op,opi){
    if(opi===pi) return false;
    return op.tokens.some(function(tok){
      return tok.pos>=0&&tok.pos<=51&&ldGlobalCell(tok.pos,op.ci)===g;
    });
  });
}

function ldUpdateStrips(){
  if(!LG.players.length) return;

  var me=LG.players[0];
  var opp=LG.players[1];

  function setText(id,val){
    var el=document.getElementById(id);
    if(el) el.textContent=val;
  }

  function renderMini(id,p){
    var el=document.getElementById(id);
    if(!el||!p) return;
    el.innerHTML=p.tokens.map(function(tok){
      var cls='ld-mini-marble';
      if(tok.pos===-1) cls+=' home';
      if(tok.pos===57) cls+=' done';
      return '<div class="'+cls+'" style="background:'+PC[p.ci].t+';color:'+PC[p.ci].s+'"></div>';
    }).join('');
  }

  function statusFor(p,pi){
    var done=ldCountDone(pi);
    var active=p.tokens.filter(function(tok){return tok.pos>=0&&tok.pos<57;}).length;
    return done+'/4 home - '+active+' active';
  }

  if(opp){
    setText('ldOppAv',opp.name.charAt(0).toUpperCase());
    setText('ldOppName',opp.name);
    setText('ldOppStatus',statusFor(opp,1));
    renderMini('ldOppTokens',opp);
  }
  if(me){
    setText('ldMyAv',me.name.charAt(0).toUpperCase());
    setText('ldMyName',me.name);
    setText('ldMyStatus',statusFor(me,0));
    renderMini('ldMyTokens',me);
  }
}

function ldLog(msg){
  var el=document.getElementById('ludoLog');
  if(!el) return;
  var row=document.createElement('div');
  row.className='ld-log-e';
  row.textContent=msg;
  el.prepend(row);
  while(el.children.length>12) el.removeChild(el.lastElementChild);
}

function ldGetMovable(pi,dice){
  var p=LG.players[pi];
  if(!p||!dice) return [];

  return p.tokens.reduce(function(list,tok,ti){
    if(ldPreviewMove(tok,dice)!==null) list.push(ti);
    return list;
  },[]);
}

function ldSetTurnUI(){
  var badge=document.getElementById('ludoTurnBadge');
  var label=document.getElementById('ludoYourTurnLabel');
  var result=document.getElementById('ludoDiceResult');
  var face=document.getElementById('ludoDiceFace');
  var btn=document.getElementById('ludoRollBtn');
  var humanTurn=LG.state==='playing'&&LG.curPlayer===0;
  var canRoll=humanTurn&&LG.diceVal===0&&!LG.moveReady&&!ANM.on;

  if(badge){
    badge.textContent=humanTurn?'Your Turn':'Opponent Turn';
    badge.classList.toggle('bot-turn',!humanTurn);
  }

  if(label){
    if(LG.state!=='playing') label.textContent='Match finished';
    else if(humanTurn&&LG.diceVal===0) label.textContent='Roll the dice';
    else if(humanTurn) label.textContent='Tap a glowing token';
    else if(LG.diceVal===0) label.textContent='Opponent is rolling';
    else label.textContent='Opponent is moving';
  }

  if(result&&LG.diceVal===0&&!ANM.on){
    result.textContent=humanTurn?'Need a lucky roll.':'Please wait for the bot.';
  }

  if(face){
    face.classList.toggle('disabled',!canRoll);
    if(LG.state==='playing'&&LG.diceVal===0&&!ANM.on) face.textContent='🎲';
    face.onclick=canRoll?ludoRoll:null;
  }

  if(btn){
    btn.disabled=!canRoll;
    btn.textContent=humanTurn?'Roll!':'Wait...';
  }
}

function ldResolveCapture(pi,ti){
  var p=LG.players[pi];
  var tok=p&&p.tokens[ti];
  if(!tok||tok.pos<0||tok.pos>51) return false;

  var cell=ldGlobalCell(tok.pos,p.ci);
  if(SAFE.indexOf(cell)!==-1) return false;

  var captured=false;
  LG.players.forEach(function(op,opi){
    if(opi===pi) return;
    op.tokens.forEach(function(ot){
      if(ot.pos>=0&&ot.pos<=51&&ldGlobalCell(ot.pos,op.ci)===cell){
        ot.pos=-1;
        captured=true;
      }
    });
    op.done=ldCountDone(opi);
  });

  if(captured) ldLog(p.name+' captured a token.');
  return captured;
}

function ldAdvanceTurn(extraTurn){
  if(LG.state!=='playing') return;

  if(!extraTurn) LG.curPlayer=(LG.curPlayer+1)%LG.players.length;

  LG.myTurn=LG.curPlayer===0;
  LG.diceVal=0;
  LG.moveReady=false;
  ldHideDiceDisplay();
  ldSetTurnUI();
  ldUpdateStrips();
  ldDraw();

  if(!LG.myTurn) ldScheduleBotTurn();
}

function ldFinishGame(pi){
  if(!LG.players[pi]) return;

  ldClearTimers();
  LG.state='done';

  var winner=LG.players[pi];
  var didWin=pi===0;
  var prize=Math.floor(LG.betAmt*2*.9);
  var ref='LUDO-'+Date.now().toString().slice(-6);
  var winBox=document.getElementById('ludoWinContent');

  if(didWin){
    balance+=prize;
    totalWins++;
    totalWonAmt+=prize;
    addTx('win',ref,prize);
    showToast('You won Rs.'+prize+'!','win');
  }else{
    totalLosses++;
    addTx('lose',ref,-LG.betAmt);
    showToast(winner.name+' won the match.','lose');
  }

  showBal();
  refreshAccount();

  if(winBox){
    if(didWin){
      winBox.innerHTML=''
        +'<div class="ld-win-card">'
        +'<span class="ld-win-emoji">Trophy</span>'
        +'<div class="ld-win-title">YOU WIN</div>'
        +'<div class="ld-win-sub">Great finish. All four tokens made it home.</div>'
        +'<div class="ld-prize-box">'
        +'<div class="ld-prize-tag">Prize</div>'
        +'<div class="ld-prize-num">Rs.'+prize+'</div>'
        +'<div class="ld-prize-sub">Bet Rs.'+LG.betAmt+' - payout credited to your balance</div>'
        +'</div>'
        +'<div class="ld-win-btns">'
        +'<button class="ld-btn-play" onclick="ludoPlayAgain()">Play Again</button>'
        +'<button class="ld-btn-home" onclick="ludoBackToLobby()">Back to Lobby</button>'
        +'</div></div>';
    }else{
      winBox.innerHTML=''
        +'<div class="ld-lose-card">'
        +'<span class="ld-lose-emoji">Try Again</span>'
        +'<div class="ld-lose-title">MATCH LOST</div>'
        +'<div class="ld-lose-sub">'+winner.name+' finished before you this round.</div>'
        +'<div class="ld-loss-box">'
        +'<div class="ld-loss-num">Rs.'+LG.betAmt+'</div>'
        +'<div class="ld-loss-lbl">Entry deducted</div>'
        +'</div>'
        +'<div class="ld-win-btns">'
        +'<button class="ld-btn-play" onclick="ludoPlayAgain()">Play Again</button>'
        +'<button class="ld-btn-home" onclick="ludoBackToLobby()">Back to Lobby</button>'
        +'</div></div>';
    }
  }

  ludoShow('win');
}

function ldCommitMove(pi,ti,dice){
  var p=LG.players[pi];
  var tok=p&&p.tokens[ti];
  var next=tok?ldPreviewMove(tok,dice):null;

  if(!tok||next===null||ANM.on||LG.state!=='playing') return;

  var steps=[];

  if(tok.pos===-1) steps=[0];
  else for(var step=tok.pos+1;step<=next;step++) steps.push(step);

  LG.moveReady=true;
  ANM.on=true;
  ANM.pi=pi;
  ANM.ti=ti;
  ANM.steps=steps;
  ANM.cur=0;

  function finalizeMove(){
    tok.pos=next;
    p.done=ldCountDone(pi);
    ANM.on=false;
    if(ANM.timer){clearTimeout(ANM.timer);ANM.timer=null;}

    if(next===57) ldLog(p.name+' sent a token home.');
    var captured=ldResolveCapture(pi,ti);
    ldUpdateStrips();
    ldDraw();

    if(ldCountDone(pi)===4){
      ldFinishGame(pi);
      return;
    }

    if(dice===6) ldLog(p.name+' earned an extra roll.');

    setTimeout(function(){
      LG.moveReady=false;
      ldAdvanceTurn(dice===6);
    },captured||next===57?900:650);
  }

  function playStep(){
    ldDraw();
    if(ANM.cur>=ANM.steps.length-1){
      ANM.timer=setTimeout(finalizeMove,ANM.DELAY);
      return;
    }
    ANM.timer=setTimeout(function(){
      ANM.cur++;
      playStep();
    },ANM.DELAY);
  }

  playStep();
}

function ldBotChooseMove(movable,dice){
  if(LG.state!=='playing'||LG.curPlayer!==1||!movable.length) return;

  movable.sort(function(a,b){
    var ta=LG.players[1].tokens[a];
    var tb=LG.players[1].tokens[b];
    var na=ldPreviewMove(ta,dice);
    var nb=ldPreviewMove(tb,dice);
    var sa=(na===57?1000:0)+(ldWillCapture(1,na)?500:0)+(ta.pos===-1?120:0)+(na||0);
    var sb=(nb===57?1000:0)+(ldWillCapture(1,nb)?500:0)+(tb.pos===-1?120:0)+(nb||0);
    return sb-sa;
  });

  ldCommitMove(1,movable[0],dice);
}

function ldRollForPlayer(pi){
  if(LG.state!=='playing'||ANM.on||LG.curPlayer!==pi||LG.diceVal!==0) return;

  LG.moveReady=true;

  var face=document.getElementById('ludoDiceFace');
  var result=document.getElementById('ludoDiceResult');
  if(face) face.classList.add('rolling');
  if(result) result.textContent='Rolling...';
  ldSetTurnUI();

  setTimeout(function(){
    var dice=1+Math.floor(Math.random()*6);
    var movable;

    LG.diceVal=dice;
    LG.moveReady=false;

    if(face){
      face.classList.remove('rolling');
      face.textContent=DICE_EMOJI[dice-1];
    }

    ldShowDiceDisplay(dice);
    if(result){
      if(dice===6) result.textContent='Lucky six. You may bring a token out.';
      else if(dice>=4) result.textContent='Big move ready.';
      else result.textContent='Small move. Choose carefully.';
    }

    ldLog(LG.players[pi].name+' rolled '+dice+'.');
    movable=ldGetMovable(pi,dice);
    ldSetTurnUI();
    ldDraw();

    if(!movable.length){
      if(result) result.textContent='No valid move this turn.';
      ldLog(LG.players[pi].name+' has no valid move.');
      LG.moveReady=true;
      setTimeout(function(){
        LG.moveReady=false;
        ldAdvanceTurn(false);
      },850);
      return;
    }

    if(pi===0){
      if(result) result.textContent='Tap a glowing token to move.';
      ldSetTurnUI();
      return;
    }

    if(result) result.textContent='Opponent is choosing a token...';
    LG.moveReady=true;
    setTimeout(function(){
      LG.moveReady=false;
      ldBotChooseMove(movable,dice);
    },650);
  },420);
}

function ldScheduleBotTurn(){
  if(LG.botTimer){clearTimeout(LG.botTimer);LG.botTimer=null;}
  LG.botTimer=setTimeout(function(){
    LG.botTimer=null;
    if(LG.state==='playing'&&LG.curPlayer===1&&!ANM.on&&LG.diceVal===0) ldRollForPlayer(1);
  },900+Math.floor(Math.random()*500));
}

function ludoRoll(){
  if(LG.state!=='playing'||LG.curPlayer!==0||!LG.myTurn||LG.diceVal!==0||LG.moveReady||ANM.on) return;
  ldRollForPlayer(0);
}

function ldClickToken(x,y){
  if(LG.state!=='playing'||LG.curPlayer!==0||!LG.myTurn||LG.diceVal===0||LG.moveReady||ANM.on) return;

  var cs=(LG.sz||280)/15;
  var movable=ldGetMovable(0,LG.diceVal);
  var chosen=-1;
  var bestDist=Infinity;

  movable.forEach(function(ti){
    var tok=LG.players[0].tokens[ti];
    var pos=tok.pos===-1
      ? {x:HOME_POS[0][ti][0]*cs,y:HOME_POS[0][ti][1]*cs}
      : ldPosToXY(tok.pos,0,cs);
    if(!pos) return;
    var dx=x-pos.x, dy=y-pos.y;
    var dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<Math.max(cs*.7,18)&&dist<bestDist){
      chosen=ti;
      bestDist=dist;
    }
  });

  if(chosen!==-1) ldCommitMove(0,chosen,LG.diceVal);
}

function ludoPlayAgain(){
  ldClearTimers();
  LG.players=[];
  LG.curPlayer=0;
  LG.diceVal=0;
  LG.myTurn=false;
  LG.moveReady=false;
  LG.state='lobby';
  ldHideDiceDisplay();
  ludoShow('lobby');
  ludoRenderRooms();
  ludoSyncBalance();
}

function ludoBackToLobby(){
  ludoPlayAgain();
}

// ===============================================
// ANDAR BAHAR
// ===============================================
var AB={
  state:'idle',
  history:[],
  andarCards:[],
  baharCards:[],
  joker:null,
  deck:[],
  bet:null,
  nextSide:'andar',
  revealTimer:null,
  nextRoundTimer:null
};

function abSyncBalance(){
  var el=document.getElementById('abBalAmt');
  if(el) el.textContent='Rs.'+balance.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function abSB(v){
  var inp=document.getElementById('abBetAmt');
  if(inp) inp.value=v;
}

function abDbl(){
  var inp=document.getElementById('abBetAmt');
  var v=inp?(parseInt(inp.value,10)||100):100;
  if(inp) inp.value=Math.min(v*2,Math.max(balance,10));
}

function abHlf(){
  var inp=document.getElementById('abBetAmt');
  var v=inp?(parseInt(inp.value,10)||100):100;
  if(inp) inp.value=Math.max(Math.floor(v/2),10);
}

function abBuildDeck(){
  var ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  var suits=[
    {s:'♠',red:false},
    {s:'♥',red:true},
    {s:'♦',red:true},
    {s:'♣',red:false}
  ];
  var deck=[];

  ranks.forEach(function(rank){
    suits.forEach(function(suit){
      deck.push({rank:rank,suit:suit.s,red:suit.red});
    });
  });

  for(var i=deck.length-1;i>0;i--){
    var j=Math.floor(Math.random()*(i+1));
    var tmp=deck[i];
    deck[i]=deck[j];
    deck[j]=tmp;
  }
  return deck;
}

function abCardMarkup(card,size){
  var w=size==='big'?64:40;
  var h=size==='big'?88:56;
  var border=card.red?'#fecdd3':'#d1d5db';
  var color=card.red?'#e8445a':'#1f2937';

  return '<div style="width:'+w+'px;height:'+h+'px;border-radius:12px;background:#fff;border:2px solid '+border+';display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:'+(size==='big'?'.98rem':'.82rem')+';color:'+color+';box-shadow:0 2px 8px rgba(0,0,0,.08);line-height:1.05;">'
    +'<div>'+card.rank+'</div>'
    +'<div style="font-size:'+(size==='big'?'1.45rem':'1rem')+';margin-top:3px;">'+card.suit+'</div>'
    +'</div>';
}

function abRenderCards(){
  var andar=document.getElementById('abAndarCards');
  var bahar=document.getElementById('abBaharCards');

  if(andar){
    andar.innerHTML=AB.andarCards.length?AB.andarCards.map(function(card){return abCardMarkup(card,'small');}).join(''):'<span style="color:var(--muted);font-size:.74rem;font-weight:600">Waiting...</span>';
  }
  if(bahar){
    bahar.innerHTML=AB.baharCards.length?AB.baharCards.map(function(card){return abCardMarkup(card,'small');}).join(''):'<span style="color:var(--muted);font-size:.74rem;font-weight:600">Waiting...</span>';
  }
}

function abRenderJoker(){
  var box=document.getElementById('abJokerCard');
  var info=document.getElementById('abJokerInfo');

  if(box){
    if(AB.joker) box.innerHTML=abCardMarkup(AB.joker,'big');
    else box.textContent='?';
  }
  if(info){
    if(AB.joker){
      info.innerHTML=''
        +'<div style="font-size:.7rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:700;">Joker Rank</div>'
        +'<div style="font-size:1rem;font-weight:800;color:var(--text);margin-top:4px;">'+AB.joker.rank+' '+AB.joker.suit+'</div>'
        +'<div style="font-size:.76rem;color:var(--muted);margin-top:4px;font-weight:500;">Bet on the side that matches this rank first.</div>';
    }else{
      info.innerHTML=''
        +'<div style="font-size:.7rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:700;">Place your bet on</div>'
        +'<div style="font-size:1rem;font-weight:800;color:var(--text);margin-top:4px;">Andar or Bahar</div>'
        +'<div style="font-size:.76rem;color:var(--muted);margin-top:4px;font-weight:500;">Match the joker rank to win.</div>';
    }
  }
}

function abSetStatus(msg,type){
  var el=document.getElementById('abStatus');
  var map={
    info:['var(--card2)','var(--border2)','var(--muted)'],
    ready:['#eff6ff','#bfdbfe','#2563eb'],
    win:['#ecfdf5','#86efac','#15803d'],
    lose:['#fff1f2','#fecdd3','#e8445a']
  };
  var tone=map[type]||map.info;

  if(!el) return;
  el.textContent=msg;
  el.style.background=tone[0];
  el.style.border='1.5px solid '+tone[1];
  el.style.color=tone[2];
  el.style.borderStyle='solid';
}

function abSetBetButtons(active,disabled){
  var andar=document.getElementById('abAndarBtn');
  var bahar=document.getElementById('abBaharBtn');

  [
    {el:andar,side:'andar',border:'var(--green)',shadow:'0 0 0 3px rgba(25,181,111,.18)',off:'#c2f0da'},
    {el:bahar,side:'bahar',border:'var(--red)',shadow:'0 0 0 3px rgba(232,68,90,.18)',off:'var(--red-m)'}
  ].forEach(function(item){
    if(!item.el) return;
    item.el.disabled=!!disabled;
    item.el.style.opacity=disabled&&active!==item.side?'.72':'1';
    item.el.style.transform=active===item.side?'translateY(-2px)':'';
    item.el.style.borderColor=active===item.side?item.border:item.off;
    item.el.style.boxShadow=active===item.side?item.shadow:'';
  });
}

function abRenderHistory(){
  var el=document.getElementById('abHistory');
  if(!el) return;

  if(!AB.history.length){
    el.innerHTML='<span style="color:var(--muted);font-size:.76rem;font-weight:500">No results yet</span>';
    return;
  }

  el.innerHTML=AB.history.map(function(item){
    var bg=item.winner==='andar'?'var(--green-l)':'var(--red-l)';
    var bd=item.winner==='andar'?'var(--green-m)':'var(--red-m)';
    var fg=item.winner==='andar'?'var(--green)':'var(--red)';
    return '<div style="padding:6px 10px;border-radius:999px;background:'+bg+';border:1px solid '+bd+';color:'+fg+';font-size:.72rem;font-weight:800;">'
      +(item.winner==='andar'?'ANDAR':'BAHAR')+' - '+item.rank
      +'</div>';
  }).join('');
}

function abShowResult(didWin,winner,matchCard,payout){
  var el=document.getElementById('abResultBox');
  if(!el) return;

  el.style.display='block';
  el.style.background=didWin?'linear-gradient(135deg,#ecfdf5,#d1fae5)':'linear-gradient(135deg,#fff1f2,#ffe4e6)';
  el.style.border='2px solid '+(didWin?'#86efac':'#fecdd3');
  el.innerHTML=''
    +'<div style="font-size:1.2rem;font-weight:900;color:'+(didWin?'#15803d':'#e8445a')+';">'+(didWin?'YOU WON':'ROUND LOST')+'</div>'
    +'<div style="font-size:.8rem;color:var(--text2);margin-top:6px;font-weight:600;">'
    +(winner==='andar'?'Andar':'Bahar')+' matched '+matchCard.rank+' '+matchCard.suit+' first.'
    +'</div>'
    +(didWin
      ? '<div style="margin-top:12px;font-size:1.45rem;font-weight:900;color:#15803d;">+Rs.'+payout.toFixed(2)+'</div><div style="font-size:.72rem;color:var(--muted);font-weight:600;">Payout at 1.9x</div>'
      : '<div style="margin-top:12px;font-size:1.3rem;font-weight:900;color:#e8445a;">-Rs.'+AB.bet.amount.toFixed(2)+'</div><div style="font-size:.72rem;color:var(--muted);font-weight:600;">Try a new round</div>');
}

function abFinishRound(winner,matchCard){
  var didWin=AB.bet&&AB.bet.side===winner;
  var payout=didWin?AB.bet.amount*1.9:0;
  var ref='AB-'+Date.now().toString().slice(-6);

  AB.state='done';
  if(AB.revealTimer){clearTimeout(AB.revealTimer);AB.revealTimer=null;}

  if(didWin){
    balance+=payout;
    totalWins++;
    totalWonAmt+=payout;
    addTx('win',ref,payout);
    showToast('Andar Bahar win!','win');
  }else{
    totalLosses++;
    addTx('lose',ref,-AB.bet.amount);
    showToast('Andar Bahar lost.','lose');
  }

  AB.history.unshift({winner:winner,rank:AB.joker.rank});
  if(AB.history.length>12) AB.history.pop();

  showBal();
  refreshAccount();
  abSyncBalance();
  abRenderHistory();
  abSetBetButtons(winner,false);
  abSetStatus((winner==='andar'?'Andar':'Bahar')+' wins with '+matchCard.rank+' '+matchCard.suit+'. Next round starts automatically. ',didWin?'win':'lose');
  abShowResult(didWin,winner,matchCard,payout);

  if(AB.nextRoundTimer){clearTimeout(AB.nextRoundTimer);AB.nextRoundTimer=null;}
  AB.nextRoundTimer=setTimeout(function(){
    AB.nextRoundTimer=null;
    abNewRound();
  },2600);
}

function abDealNext(){
  if(AB.state!=='dealing') return;
  if(!AB.deck.length) AB.deck=abBuildDeck();

  var card=AB.deck.pop();
  var side=AB.nextSide;

  if(side==='andar') AB.andarCards.push(card);
  else AB.baharCards.push(card);

  abRenderCards();

  if(card.rank===AB.joker.rank){
    abFinishRound(side,card);
    return;
  }

  AB.nextSide=side==='andar'?'bahar':'andar';
  AB.revealTimer=setTimeout(abDealNext,420);
}

function abNewRound(){
  if(AB.revealTimer){clearTimeout(AB.revealTimer);AB.revealTimer=null;}
  if(AB.nextRoundTimer){clearTimeout(AB.nextRoundTimer);AB.nextRoundTimer=null;}

  AB.deck=abBuildDeck();
  AB.joker=AB.deck.pop();
  AB.andarCards=[];
  AB.baharCards=[];
  AB.bet=null;
  AB.nextSide='andar';
  AB.state='betting';

  var result=document.getElementById('abResultBox');
  if(result) result.style.display='none';

  abRenderJoker();
  abRenderCards();
  abRenderHistory();
  abSetBetButtons('',false);
  abSetStatus('Round ready. Bet on Andar or Bahar to start dealing.','ready');
}

function abPlaceBet(side){
  var inp=document.getElementById('abBetAmt');
  var amount=inp?(parseInt(inp.value,10)||0):0;

  if(AB.nextRoundTimer){clearTimeout(AB.nextRoundTimer);AB.nextRoundTimer=null;}

  if(AB.state==='idle'){
    showToast('Start a new round first.','info');
    return;
  }
  if(AB.state!=='betting'){
    showToast('Current round is already running.','info');
    return;
  }
  if(!amount||amount<10){
    showToast('Min bet Rs.10','lose');
    return;
  }
  if(amount>balance){
    showToast('Insufficient balance!','lose');
    return;
  }

  balance-=amount;
  showBal();
  abSyncBalance();

  AB.bet={side:side,amount:amount};
  AB.state='dealing';
  AB.nextSide='andar';
  abSetBetButtons(side,true);
  abSetStatus('Bet placed on '+(side==='andar'?'Andar':'Bahar')+'. Dealing cards...','info');
  showToast((side==='andar'?'Andar':'Bahar')+' selected.','info');

  var result=document.getElementById('abResultBox');
  if(result) result.style.display='none';

  AB.revealTimer=setTimeout(abDealNext,380);
}
