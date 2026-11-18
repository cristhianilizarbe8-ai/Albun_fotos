/* ============================================================
   1) CONFIGURA TU SUPABASE AQUÍ
      - Crea un proyecto en https://supabase.com
      - Crea un bucket público de Storage llamado: fotos-recuerdos
      - Crea una tabla llamada: recuerdos  con columnas:
          id (uuid, default gen_random_uuid(), primary key)
          url (text)
          caption (text)
          fecha (date, nullable)
          created_at (timestamp, default now())
      - Copia tu Project URL y anon public key abajo
   ============================================================ */
const SUPABASE_URL = 'https://yqococzxsvspdftprbjf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f_WY2nH12qcyB07k87hbzg_OyplgPGI';
const BUCKET = 'fotos-recuerdos';
const TABLE = 'recuerdos';
const LOCK_PASSWORD = '12345'; // <-- cambia esto por su clave secreta
const DEFAULT_MUSIC = 'musica/nuestra-cancion.mp3'; // <-- tu canción, ya guardada en la carpeta musica

let sb = null;
const demoMode = (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY');
if (!demoMode) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const rotations = [-6,-3,-1,2,4,6,-4,1,-2,5];
const tapeLeft  = ['8px','auto','14px','auto','20px'];

/* ---------- Lock screen ---------- */
function tryUnlock(){
  const val = document.getElementById('lockInput').value.trim().toLowerCase();
  if (val === LOCK_PASSWORD.toLowerCase()) {
    document.getElementById('lockScreen').classList.add('opened');
    document.getElementById('app').style.display = 'block';
    document.getElementById('fab').style.display = 'flex';
    document.getElementById('fab').style.alignItems='center';
    document.getElementById('fab').style.justifyContent='center';
    document.getElementById('musicBar').style.display='flex';
    startDefaultMusic();
    loadMemories();
  } else {
    document.getElementById('lockError').textContent = 'Clave incorrecta, inténtalo de nuevo mi amor 💕';
  }
}
document.getElementById('lockInput').addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(); });

/* ---------- Corazones flotantes ---------- */
function spawnHeart(){
  const el = document.createElement('div');
  el.className='floating-heart';
  el.textContent = Math.random() > .5 ? '❤' : '💗';
  el.style.left = Math.random()*100 + 'vw';
  el.style.setProperty('--drift', (Math.random()*80-40)+'px');
  const duration = 7 + Math.random()*6;
  el.style.animationDuration = duration+'s';
  el.style.fontSize = (14 + Math.random()*16)+'px';
  document.getElementById('heartsField').appendChild(el);
  setTimeout(()=>el.remove(), duration*1000);
}
setInterval(spawnHeart, 900);

/* ---------- Datos: memorias ---------- */
let memories = [];

async function loadMemories(){
  if (sb){
    const { data, error } = await sb.from(TABLE).select('*').order('created_at', {ascending:false});
    if (error){ console.error(error); memories = []; }
    else { memories = data || []; }
  } else {
    document.getElementById('demoBanner').style.display='block';
    memories = JSON.parse(localStorage.getItem('demo_memories') || '[]');
  }
  renderBoard();
}

function renderBoard(){
  const board = document.getElementById('board');
  document.getElementById('countNum').textContent = memories.length;
  if (memories.length === 0){
    board.innerHTML = `<div class="empty-state"><span class="script">Aún no hay recuerdos aquí</span>Toca el botón 💗 para subir su primera foto</div>`;
    return;
  }
  board.innerHTML = memories.map((m,i)=>{
    const rot = rotations[i % rotations.length];
    const tapeSide = (i % 2 === 0) ? 'left:14px;' : 'right:14px;';
    const fecha = m.fecha ? new Date(m.fecha+'T00:00:00').toLocaleDateString('es-PE', {day:'numeric', month:'long', year:'numeric'}) : '';
    return `
      <div class="polaroid" style="transform:rotate(${rot}deg);" onclick='openView(${i})'>
        <div class="tape" style="${tapeSide}"></div>
        <img src="${m.url}" loading="lazy" alt="recuerdo">
        ${m.caption ? `<div class="cap">${escapeHtml(m.caption)}</div>` : ''}
        ${fecha ? `<div class="date">${fecha}</div>` : ''}
      </div>`;
  }).join('');
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

let currentViewIndex = null;

function openView(i){
  currentViewIndex = i;
  const m = memories[i];
  document.getElementById('viewImg').src = m.url;
  document.getElementById('viewCap').textContent = m.caption || '';
  document.getElementById('viewDate').textContent = m.fecha ? new Date(m.fecha+'T00:00:00').toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric'}) : '';
  showModal('viewModal');
}

async function deleteCurrentMemory(){
  if (currentViewIndex === null) return;
  const m = memories[currentViewIndex];
  if (!confirm('¿Seguro que quieres eliminar este recuerdo? No se puede deshacer 💔')) return;

  try{
    if (sb){
      const marker = `/public/${BUCKET}/`;
      const idx = m.url.indexOf(marker);
      if (idx !== -1){
        const path = m.url.substring(idx + marker.length);
        const { error: delFileErr } = await sb.storage.from(BUCKET).remove([path]);
        if (delFileErr) console.warn('No se pudo borrar el archivo:', delFileErr);
      }
      if (m.id){
        const { error: delRowErr } = await sb.from(TABLE).delete().eq('id', m.id);
        if (delRowErr) throw delRowErr;
      }
    } else {
      memories.splice(currentViewIndex, 1);
      localStorage.setItem('demo_memories', JSON.stringify(memories));
    }
    closeModal('viewModal');
    await loadMemories();
  } catch(err){
    console.error(err);
    alert('No se pudo eliminar: ' + (err.message || JSON.stringify(err)));
  }
}

/* ---------- Subida ---------- */
function openUpload(){
  showModal('uploadModal');
}

async function handleUpload(){
  const files = document.getElementById('fileInput').files;
  const caption = document.getElementById('captionInput').value.trim();
  const fecha = document.getElementById('dateInput').value;
  const status = document.getElementById('uploadStatus');

  if (!files || files.length === 0){ status.textContent='Elige al menos una foto.'; return; }
  const toUpload = Array.from(files);
  status.textContent = `Subiendo 0/${toUpload.length}...`;

  let done = 0;
  for (const file of toUpload){
    try{
      if (sb){
        const small = await compressImage(file);
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(path, small, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
        const { error: insErr } = await sb.from(TABLE).insert({ url: pub.publicUrl, caption, fecha: fecha || null });
        if (insErr) throw insErr;
      } else {
        const dataUrl = await fileToDataUrl(file);
        memories.unshift({ url: dataUrl, caption, fecha: fecha || null, created_at: new Date().toISOString() });
        localStorage.setItem('demo_memories', JSON.stringify(memories));
      }
      done++;
      status.textContent = `Subiendo ${done}/${toUpload.length}...`;
    } catch(err){
      console.error(err);
      status.textContent = `Ocurrió un error subiendo "${file.name}". Revisa tu configuración de Supabase.`;
      break;
    }
  }
  status.textContent = `¡Listo! ${done} foto(s) guardadas 💗`;
  await loadMemories();
  setTimeout(()=>{ closeModal('uploadModal'); document.getElementById('fileInput').value=''; document.getElementById('captionInput').value=''; document.getElementById('dateInput').value=''; status.textContent=''; }, 900);
}

// Reduce el tamaño de la foto (máx 1600px, JPG 80%) para ahorrar espacio
function compressImage(file, maxSide = 1600, quality = 0.8){
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => resolve(b && b.size < file.size ? b : file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ---------- Modales genéricos ---------- */
function showModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target === ov) ov.classList.remove('show'); });
});

/* ---------- Música ---------- */
const audioPlayer = document.getElementById('audioPlayer');

function startDefaultMusic(){
  if (audioPlayer.src) return; // ya hay una canción cargada (ej. elegida manualmente)
  audioPlayer.src = DEFAULT_MUSIC;
  document.getElementById('musicTitle').textContent = 'Nuestra canción';
  audioPlayer.play().then(()=>{
    document.getElementById('playToggle').textContent = '⏸';
    document.getElementById('eq').classList.remove('paused');
  }).catch(()=>{
    // el navegador bloqueó el autoplay con sonido; se queda pausado hasta que le den play
    document.getElementById('playToggle').textContent = '▶';
    document.getElementById('eq').classList.add('paused');
  });
}

function loadMusic(e){
  const file = e.target.files[0];
  if (!file) return;
  audioPlayer.src = URL.createObjectURL(file);
  document.getElementById('musicTitle').textContent = file.name.replace(/\.[^/.]+$/, '');
  audioPlayer.play();
  document.getElementById('playToggle').textContent = '⏸';
  document.getElementById('eq').classList.remove('paused');
}
function toggleMusic(){
  if (!audioPlayer.src){ document.getElementById('musicFile').click ? null : null; return; }
  if (audioPlayer.paused){
    audioPlayer.play();
    document.getElementById('playToggle').textContent = '⏸';
    document.getElementById('eq').classList.remove('paused');
  } else {
    audioPlayer.pause();
    document.getElementById('playToggle').textContent = '▶';
    document.getElementById('eq').classList.add('paused');
  }
}
