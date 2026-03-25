import { useState, useEffect, useReducer, useCallback } from "react";

// ════════════════════════════════════════
// FETCH COM TIMEOUT (90s para Groq API)
// ════════════════════════════════════════
function extractJSON(text) {
  var clean = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch(e) {}
  // Tenta extrair JSON de dentro do texto
  var match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch(e) {}
  }
  // Fallback: tenta extrair múltiplos objetos JSON espalhados no texto
  var jsonObjects = [];
  var re = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  var m2;
  while ((m2 = re.exec(clean)) !== null) {
    try {
      var obj = JSON.parse(m2[0]);
      if (obj.enunciado || obj.frente || obj.caso || obj.flashcards || obj.questoes) {
        jsonObjects.push(obj);
      }
    } catch(e2) {}
  }
  if (jsonObjects.length > 0) {
    // Se encontrou objetos com "enunciado", é uma lista de questões
    if (jsonObjects[0].enunciado) return { questoes: jsonObjects };
    // Se encontrou objetos com "frente", é flashcards
    if (jsonObjects[0].frente) return { flashcards: jsonObjects };
    // Se tem questoes ou caso dentro, retorna direto
    if (jsonObjects[0].questoes) return jsonObjects[0];
    if (jsonObjects[0].caso) return jsonObjects[0];
    if (jsonObjects[0].flashcards) return jsonObjects[0];
  }

  // Fallback: tenta parsear Markdown de questões
  var questoes = [];
  var blocks = clean.split(/(?:####?\s*Questão\s*\d+|\*\*Questão\s*\d+\*\*)/i).filter(function(b) { return b.trim(); });
  if (blocks.length > 1) {
    blocks.forEach(function(block) {
      var enunciado = "", alternativas = [], correta = 0, explicacao = "", tema = "", dificuldade = "";
      var temaMatch = block.match(/\*\*Tema:\*\*\s*(.+)/i);
      if (temaMatch) tema = temaMatch[1].trim();
      var diffMatch = block.match(/\*\*Dificuldade:\*\*\s*(.+)/i);
      if (diffMatch) dificuldade = diffMatch[1].trim();
      var enunMatch = block.match(/\*\*Enunciado:\*\*\s*([\s\S]*?)(?=\*\*Alternativas)/i);
      if (enunMatch) enunciado = enunMatch[1].trim();
      var altMatch = block.match(/\*\*Alternativas:\*\*([\s\S]*?)(?=\*\*Correta)/i);
      if (altMatch) {
        var altLines = altMatch[1].match(/[A-D]\)\s*[^\n]+/g);
        if (altLines) alternativas = altLines.map(function(a) { return a.trim(); });
      }
      var corrMatch = block.match(/\*\*Correta:\*\*\s*([A-D])\)/i);
      if (corrMatch) correta = corrMatch[1].charCodeAt(0) - 65;
      var explMatch = block.match(/\*\*Explicação:\*\*\s*([\s\S]*?)$/i);
      if (explMatch) explicacao = explMatch[1].trim();
      if (enunciado && alternativas.length >= 2) {
        questoes.push({ enunciado: enunciado, alternativas: alternativas, correta: correta, explicacao: explicacao, tema: tema, dificuldade: dificuldade });
      }
    });
    if (questoes.length > 0) return { questoes: questoes };
  }
  throw new Error("Não foi possível extrair JSON da resposta");
}

function fetchAI(body) {
  var controller = new AbortController();
  var id = setTimeout(function() { controller.abort(); }, 120000);
  var apiBase = window.location.hostname === "localhost" ? "http://localhost:3001" : "";
  return fetch(apiBase + "/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(function(r) { clearTimeout(id); return r; });
}

// ════════════════════════════════════════
// DADOS DO CURSO
// ════════════════════════════════════════
const MODULES = [
  {
    id: 1, name: "Dominando a Emergência das Emergências", weeks: 3,
    color: "#FF4D6D", icon: "🚨",
    lessons: [
      "PCR com e sem ritmo chocável", "Dúvidas sobre PCR",
      "PCR na rua – Suporte Básico de Vida", "Dúvidas sobre PCR na rua",
      "Cuidados pós PCR", "Caso clínico pós PCR",
      "Taquiarritmias", "Caso clínico Taquiarritmias", "Bradiarritmias"
    ],
    defaultWatched: [],
    topics: ["PCR","Suporte Básico de Vida","Cuidados pós-PCR","Taquiarritmias","Bradiarritmias"]
  },
  {
    id: 2, name: "Emergências Cardiológicas", weeks: 8,
    color: "#FF6B35", icon: "🫀",
    lessons: [
      "Sist. Cardiocirculatório Pt1","Sist. Cardiocirculatório Pt2","Sist. Cardiocirculatório Pt3",
      "IC Aguda Pt1","IC Aguda Pt2","IC Aguda Pt3",
      "Taquiarritmias Pt1","Taquiarritmias Pt2","Taquiarritmias Pt3",
      "FA (2025) Pt1","FA Pt2","FA Pt3",
      "Bradiarritmias Pt1","Bradiarritmias Pt2","Bradiarritmias Pt3",
      "IAM Supra ST Pt1","IAM Supra ST Pt2","IAM Supra ST Pt3",
      "SCA Pt1","SCA Pt2","SCA Pt3","Infarto VD",
      "BRE Pt1","BRE Pt2","BRE Pt3",
      "EAP Pt1","EAP Pt2","EAP Pt3",
      "HAS Crises Pt1","HAS Crises Pt2","HAS Crises Pt3",
      "TEP Pt1","TEP Pt2","TEP Pt3",
      "TVP Fisiopato","TVP Tratamento","TVP Caso","TVP Dúvidas",
      "OAA Pt1","OAA Pt2","OAA Pt3",
      "Dissecção Aorta Pt1","Dissecção Aorta Pt2","Dissecção Aorta Pt3","Dissecção Caso",
      "Emerg HAS Gestacional Pt1","Emerg HAS Gestacional Pt2","Emerg HAS Gestacional Pt3"
    ],
    defaultWatched: [],
    topics: ["IC Aguda","Arritmias","FA","Bradiarritmias","IAM/SCA","BRE","EAP","HAS Crises","TEP","TVP","OAA","Dissecção Aorta","Emerg. HAS Gestacional"]
  },
  {
    id: 3, name: "Infecções Mais Frequentes", weeks: 7,
    color: "#4CC9F0", icon: "🦠",
    lessons: [
      "IVAS Gripes Pt1","IVAS Gripes Pt2","IVAS Gripes Pt3","IVAS Faringite/Otite",
      "IVAS RSA Pt1","IVAS RSA Pt2","IVAS RSA Pt3",
      "IVAS Faringite Pt1","IVAS Faringite Pt2","IVAS Faringite Pt3","Retirada inseto",
      "PAC Pt1","PAC Pt2","PAC Pt3",
      "Inf. Cutâneas Visão geral","Impetigo","Foliculite","Furúnculo",
      "Erisipela x Celulite","Fasciíte Necrosante","Inf. Cutâneas Caso",
      "ITU Pt1","ITU Pt2","ITU Pt3","Sondagem Vesical",
      "GECA Pt1","GECA Pt2","GECA Pt3",
      "Sepse Pt1","Sepse Pt2","Sepse Pt3",
      "Dengue Pt1","Dengue Pt2","Dengue Pt3","Chikungunya","Zika",
      "Meningites Pt1","Meningites Pt2","Meningites Pt3",
      "DIP Pt1","DIP Pt2","DIP Pt3","Resumo Infecções",
      "Síndrome Febril Pt1","Síndrome Febril Pt2","Síndrome Febril Pt3",
      "Leptospirose Pt1","Leptospirose Pt2"
    ],
    defaultWatched: [],
    topics: ["IVAS","PAC","Inf. Cutâneas","ITU","GECA","Sepse","Dengue/Chik/Zika","Meningites","DIP","Síndrome Febril","Leptospirose"]
  },
  {
    id: 4, name: "Doenças Respiratórias", weeks: 5,
    color: "#06D6A0", icon: "🫁",
    lessons: [
      "IOT Pt1","IOT Pt2","IOT Dúvidas",
      "Gasometria Pt1","Gasometria Pt2","Gasometria Pt3",
      "DPOC Pt1","DPOC Pt2","DPOC Pt3",
      "Asma Pt1","Asma Pt2","Asma Pt3",
      "Insuf. Resp. Pt1","Insuf. Resp. Pt2","Insuf. Resp. Casos",
      "VM Pt1","VM Pt2","VM Simulador",
      "Desmame VM Sedação","Desmame VM TRE","Desmame VM Dúvidas","Desmame VM Simulador"
    ],
    defaultWatched: [],
    topics: ["IOT","Gasometria","DPOC","Asma","Insuf. Resp.","VM","Desmame VM"]
  },
  {
    id: 5, name: "Trauma", weeks: 5,
    color: "#F77F00", icon: "🩻",
    lessons: [
      "Politrauma X e A","Politrauma BCDE","Politrauma Caso",
      "Trauma Torácico Pt1","Trauma Torácico Pt2","Trauma Torácico Casos","Trauma Torácico Dúvidas",
      "Trauma Abd/Pélvico Pt1","Trauma Abd/Pélvico Pt2","Trauma Abd/Pélvico Casos","Trauma Abd/Pélvico Dúvidas",
      "Choques Pt1","Choques Pt2","Choques Pt3",
      "TCE Pt1","TCE Pt2","TCE Caso","TCE Dúvidas",
      "TRM Entendendo","TRM Choque neurogênico","TRM Caso","TRM Dúvidas",
      "Afogamento Fisiopato","Afogamento Graus","Afogamento Caso","Afogamento Dúvidas",
      "Queimaduras Tipos","Queimaduras Condutas","Queimaduras Caso"
    ],
    defaultWatched: [],
    topics: ["Politrauma","Trauma Torácico","Trauma Abd/Pélvico","Choques","TCE","TRM","Afogamento","Queimaduras"]
  },
  {
    id: 6, name: "Situações Frequentes no PA", weeks: 8,
    color: "#7B2FBE", icon: "🏥",
    lessons: [
      "Dor Abdominal Tipos","Dor Abdominal Alarme","Dor Abdominal Raciocínio",
      "Dor Abdominal Casos","Dor Abdominal Casos2","Dor Abdominal Dúvidas",
      "Cólica Nefrítica Pt1","Cólica Nefrítica Pt2","Cólica Nefrítica Pt3",
      "Anafilaxia Pt1","Anafilaxia Pt2","Anafilaxia Pt3",
      "Intox. Exógenas Pt1","Intox. Exógenas Pt2","Intox. Exógenas Pt3",
      "Animais Peçonh. Pt1","Animais Peçonh. Pt2","Animais Peçonh. Casos","Animais Peçonh. Dúvidas",
      "Lombalgias Passo a passo","Lombalgias Medicações","Lombalgias Dúvidas",
      "Vertigens Fisiologia","Vertigens Tratamento","Vertigens Casos","Vertigens Dúvidas",
      "Emerg. Psiq. Suicídio","Emerg. Psiq. Agitação","Emerg. Psiq. Caso","Emerg. Psiq. Dúvidas",
      "Pancreatite Pt1","Pancreatite Pt2","Pancreatite Pt3","Complicações Pancreatite",
      "Artrite Gotosa","Gota Fisiopato Pt1","Gota Caso","Gota Diagnóstico Pt2","Gota Dúvidas","Gota Prescrição Pt3",
      "HDA x HDB","Hemorragias Tratamentos","Hemorragias Dúvidas",
      "Abd. Obstrutivo Fisiopato","Abd. Obstrutivo Raciocínio","Abd. Obstrutivo Caso","Abd. Obstrutivo Dúvidas",
      "Abd. Inflamatório Pt1","Abd. Inflamatório Pt2","Abd. Inflamatório Pt3","Intox. Metanol"
    ],
    defaultWatched: [],
    topics: ["Dor Abdominal","Cólica Nefrítica","Anafilaxia","Intox. Exógenas","Animais Peçonh.","Lombalgias","Vertigens","Emerg. Psiq.","Pancreatite","Gota","HDA/HDB","Abd. Obstrutivo","Abd. Inflamatório"]
  },
  {
    id: 7, name: "Emergências Neurológicas", weeks: 4,
    color: "#E040FB", icon: "🧠",
    lessons: [
      "AVC Pt1","AVC Pt2","AVC Pt3","AIT","AIT Caso",
      "Crises Convulsivas Tipos","Crises Convulsivas Tratamento","Crises Convulsivas Casos","Crises Convulsivas Dúvidas",
      "Cefaleias Pt1","Cefaleias Pt2","Cefaleias Casos","Cefaleias Dúvidas",
      "Vertigens Fisiologia","Vertigens Tratamentos","Vertigens Casos","Vertigens Dúvidas",
      "Rebaixamento Consciência Pt1","Rebaixamento Consciência Pt2","Rebaixamento Consciência Pt3",
      "Síncope Pt1","Síncope Pt2","Síncope Pt3"
    ],
    defaultWatched: [],
    topics: ["AVC","AIT","Crises Convulsivas","Cefaleias","Vertigens","Rebaixamento Consciência","Síncope"]
  },
  {
    id: 8, name: "Distúrbios Metabólicos", weeks: 4,
    color: "#FFD60A", icon: "⚗️",
    lessons: [
      "Hiponatremia Pt1","Hiponatremia Pt2","Hiponatremia Pt3",
      "Hipernatremia Pt1","Hipernatremia Pt2",
      "Hipercalemia","Hipercalemia Casos",
      "Hipocalemia e Mg/Ca","Hipocalemia Casos",
      "CAD/EHH Pt1","CAD/EHH Pt2","CAD/EHH Pt3",
      "Hipoglicemia Pt1","Hipoglicemia Pt2",
      "LRA Conceito","LRA Diagnóstico","LRA Casos","LRA Dúvidas"
    ],
    defaultWatched: [],
    topics: ["Hiponatremia","Hipernatremia","Hipercalemia","Hipocalemia","CAD/EHH","Hipoglicemia","LRA"]
  },
];

const TOTAL_WEEKS = MODULES.reduce(function(s, m) { return s + m.weeks; }, 0);
const TOTAL_LESSONS = MODULES.reduce(function(s, m) { return s + m.lessons.length; }, 0);
const DIFF_LABELS = ["Muito Fácil", "Fácil", "Moderado", "Difícil", "Muito Difícil", "Impossível"];
const DIFF_COLORS = ["#4CC9F0", "#06D6A0", "#F77F00", "#FF4D6D", "#E040FB", "#ff0040"];
const DIFF_EMOJI = ["🔵", "🟢", "🟡", "🔴", "💀", "☠️"];
const DIFF_POINTS = [2, 3, 3, 4, 5, 1]; // pontos pra subir de cada nível

// topicLevels armazena { tema: { questions: {nivel,pontos}, cases: {nivel,pontos}, diagnostic: {nivel,pontos} } }
var ACTIVITY_TYPES = ["questions", "cases", "diagnostic"];
var ACTIVITY_LABELS = { questions: "Questões", cases: "Caso", diagnostic: "Investig." };

function getTopicLevel(topicLevels, topic, activity) {
  var tl = topicLevels[topic];
  if (!tl) return { nivel: 0, pontos: 0 };
  // Migração: formato antigo era número simples
  if (typeof tl === "number") return { nivel: Math.min(5, Math.floor(tl / 3)), pontos: 0 };
  // Migração: formato antigo era {nivel, pontos} sem atividade
  if (typeof tl.nivel === "number") {
    if (!activity) return { nivel: tl.nivel || 0, pontos: tl.pontos || 0 };
    return { nivel: 0, pontos: 0 };
  }
  if (typeof tl !== "object") return { nivel: 0, pontos: 0 };
  if (!activity) {
    // Sem atividade: retorna o maior nível entre as atividades
    var best = { nivel: 0, pontos: 0 };
    ACTIVITY_TYPES.forEach(function(a) {
      if (tl[a] && (tl[a].nivel > best.nivel || (tl[a].nivel === best.nivel && tl[a].pontos > best.pontos))) {
        best = { nivel: tl[a].nivel, pontos: tl[a].pontos };
      }
    });
    return best;
  }
  var act = tl[activity];
  if (!act) return { nivel: 0, pontos: 0 };
  return { nivel: act.nivel || 0, pontos: act.pontos || 0 };
}
function getDiffFromLevel(topicLevels, topic, activity) {
  return getTopicLevel(topicLevels, topic, activity).nivel;
}

function ProgressCircles({ nivel, pontos, color }) {
  var needed = DIFF_POINTS[nivel] || 1;
  var circles = [];
  for (var i = 0; i < needed; i++) {
    circles.push(
      <span key={i} style={{
        display: "inline-block",
        width: 10, height: 10,
        borderRadius: "50%",
        border: "2px solid " + color,
        background: i < pontos ? color : "transparent",
        marginRight: 3,
      }} />
    );
  }
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>{circles}</span>;
}

function DiffBadge({ topic, topicLevels }) {
  var tl = getTopicLevel(topicLevels, topic);
  var nivel = tl.nivel;
  var pontos = tl.pontos;
  var dc = DIFF_COLORS[nivel] || DIFF_COLORS[0];
  var label = DIFF_LABELS[nivel] || DIFF_LABELS[0];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: dc + "18", color: dc }}>
      {DIFF_EMOJI[nivel]} {label} <ProgressCircles nivel={nivel} pontos={pontos} color={dc} />
    </span>
  );
}

const BLOCK_TYPES = {
  theory:   { color: "#4CC9F0", bg: "rgba(76,201,240,0.08)",  icon: "📖", label: "Teoria" },
  practice: { color: "#FF4D6D", bg: "rgba(255,77,109,0.08)",  icon: "🩺", label: "Prática" },
  review:   { color: "#06D6A0", bg: "rgba(6,214,160,0.08)",   icon: "🔄", label: "Revisão" },
};

const GUIDES = {
  theory: {
    t: "📖 Aulas",
    d: "A aula é o ponto de partida do aprendizado. O objetivo não é só assistir, mas construir uma memória ativa do conteúdo. Estudos mostram que anotar à mão (não digitar) aumenta significativamente a retenção, porque força seu cérebro a processar e resumir — e não apenas copiar.",
    tips: [
      "Assista na velocidade 1x ou no máximo 1.25x — velocidades maiores prejudicam a compreensão em conteúdos técnicos como medicina",
      "Pause o vídeo sempre que surgir um conceito novo ou uma dúvida. Não deixe acumular — resolva na hora buscando no material ou anotando para perguntar depois",
      "Após cada aula, feche o caderno e tente explicar o conteúdo em voz alta como se fosse para um paciente leigo. Essa técnica (Feynman) revela exatamente o que você não entendeu de verdade",
      "Limite seus destaques a no máximo 3 pontos por aula. Sublinhar tudo é o mesmo que não sublinhar nada — seu cérebro para de filtrar o que é importante",
      "Anote suas dúvidas em um caderno separado ou no celular. Revise essa lista semanalmente e pesquise ativamente cada uma delas"
    ]
  },
  review: {
    t: "🃏 Flashcards",
    d: "Os flashcards com repetição espaçada são a técnica de memorização mais validada pela ciência. O app cria flashcards automaticamente dos temas que você erra e agenda revisões em intervalos crescentes (1, 3, 7, 14, 30 dias). Revise na aba Flashcards — quanto mais consistente, mais forte a memória.",
    tips: [
      "Revise os flashcards pendentes todos os dias — leva poucos minutos e o impacto na retenção é enorme",
      "Ao revisar, tente lembrar a resposta ANTES de virar o card. Só olhar a resposta sem tentar não ativa a memória",
      "Se marcou 'Não lembrei', o card volta amanhã. Se marcou 'Lembrei', o intervalo aumenta. Confie no sistema",
      "Os flashcards são gerados a partir dos seus erros nas atividades com o Claude. Quanto mais praticar, mais cards úteis terá",
      "Reserve os primeiros 15 minutos de cada sessão de estudo para revisar flashcards — antes de começar algo novo"
    ]
  },
  practice: {
    t: "🩺 Questões",
    d: "Na aba Atividades, você gera um prompt e cola no Claude para praticar questões adaptativas. O Claude faz questões no seu nível, explica cada alternativa, e no final gera um relatório que atualiza seu progresso no app automaticamente.",
    tips: [
      "O sistema adapta a dificuldade por tema: acertos sobem o nível, erros voltam para reforço",
      "Quando errar, não apenas leia a explicação — escreva com suas próprias palavras por que errou. Isso ativa a memória de forma muito mais profunda",
      "Após terminar, digite 'finalizei' no Claude e importe o relatório na aba Atividades para atualizar seu progresso",
      "Faça pelo menos uma sessão de questões após cada aula, ainda que curta (10–15 min). O impacto na retenção é muito maior do que estudar por horas sem praticar",
      "Varie entre Questões, Caso Clínico e Investigação Clínica — cada formato treina um aspecto diferente do raciocínio médico"
    ]
  },
  consolidation: {
    t: "🧠 Mapa Mental / Resumo",
    d: "Mapas mentais e resumos forçam você a organizar o que aprendeu de forma estruturada. Quando consegue montar um mapa mental completo de um tema sem consultar nada, significa que realmente dominou o conteúdo. É diferente de decorar — é compreender a lógica por trás.",
    tips: [
      "Use Xmind (gratuito), Canva ou papel e caneta colorida. O importante é ser visual e hierárquico",
      "Estruture sempre igual: centro = diagnóstico/tema, ramos = fisiopatologia, clínica, exames, tratamento e complicações",
      "Use cores diferentes para cada ramo. Cores criam âncoras visuais e tornam a memorização mais eficiente",
      "Depois de montar, compare com o material do curso. As diferenças revelam pontos cegos",
      "Guarde todos os mapas em uma pasta. Antes de provas ou plantões, uma revisão rápida dos mapas ativa memórias muito mais rápido do que reler textos longos"
    ]
  },
};

// ════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════
function buildDefaultWatched() {
  var w = {};
  MODULES.forEach(function(m) { w[m.id] = m.defaultWatched.slice(); });
  return w;
}

function getFirstIncompleteWeek(ws) {
  var a = 0;
  for (var i = 0; i < MODULES.length; i++) {
    var m = MODULES[i];
    if ((ws[m.id] || []).length < m.lessons.length) return a + 1;
    a += m.weeks;
  }
  return 1;
}

function getModuleForWeek(w) {
  var a = 0;
  for (var i = 0; i < MODULES.length; i++) {
    if (w <= a + MODULES[i].weeks) return MODULES[i];
    a += MODULES[i].weeks;
  }
  return MODULES[MODULES.length - 1];
}

function getUniqueTopicFromLesson(name) {
  return name
    .replace(/\s*(Pt\d+|Parte\s*\d+|Dúvidas|Casos?(\s+Clínico)?s?|Caso\d*|Fisiopato|Tratamento|Checklist|Visão geral|Passo a passo|Medicações|Gripes|Entendendo|Condutas|Tipos|Fisiologia|Raciocínio|Alarme|Simulador)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(str) {
  return str.toLowerCase()
    .replace(/[áàâã]/g, "a").replace(/[éèê]/g, "e").replace(/[íìî]/g, "i")
    .replace(/[óòôõ]/g, "o").replace(/[úùû]/g, "u").replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

function lessonMatchesTopic(lesson, topic) {
  var nLesson = normalize(lesson);
  var nTopic = normalize(topic);
  var nClean = normalize(getUniqueTopicFromLesson(lesson));
  if (nClean === nTopic || nLesson.indexOf(nTopic) >= 0 || nTopic.indexOf(nClean) >= 0) return true;
  // Tenta match por palavras-chave: se o tema tem "/", testa cada parte
  var parts = topic.split(/[\/,]+/).map(function(p) { return normalize(p.trim()); }).filter(Boolean);
  if (parts.length > 1) {
    if (parts.some(function(p) { return nLesson.indexOf(p) >= 0; })) return true;
  }
  // Tenta match por palavras significativas do tema (>3 chars)
  var words = topic.split(/[\s\/\.\-,]+/).map(function(w) { return normalize(w); }).filter(function(w) { return w.length > 3; });
  if (words.length > 0 && words.some(function(w) { return nLesson.indexOf(w) >= 0; })) return true;
  return false;
}

function makeSchedule(weekNum) {
  var mod = getModuleForWeek(weekNum);
  return {
    module: mod,
    days: [
      { day: "Seg", hours: "4h", blocks: [
        { label: "Aula", dur: "2h", type: "theory", gk: "theory" },
        { label: "Flashcards", dur: "1h", type: "review", gk: "review" },
        { label: "Questões", dur: "1h", type: "practice", gk: "practice" },
      ]},
      { day: "Ter", hours: "4h", blocks: [
        { label: "Aula", dur: "2.5h", type: "theory", gk: "theory" },
        { label: "Caso Clínico", dur: "1.5h", type: "practice", gk: "practice" },
      ]},
      { day: "Qua", hours: "4h", blocks: [
        { label: "Aula", dur: "2h", type: "theory", gk: "theory" },
        { label: "Flashcards", dur: "1h", type: "review", gk: "review" },
        { label: "Questões", dur: "1h", type: "practice", gk: "practice" },
      ]},
      { day: "Qui", hours: "4h", blocks: [
        { label: "Aula", dur: "2h", type: "theory", gk: "theory" },
        { label: "Mapa Mental / Resumo", dur: "1h", type: "review", gk: "consolidation" },
        { label: "Investigação Clínica", dur: "1h", type: "practice", gk: "practice" },
      ]},
      { day: "Sex", hours: "4h", blocks: [
        { label: "Revisão da Semana", dur: "1.5h", type: "review", gk: "review" },
        { label: "Questões + Casos", dur: "2.5h", type: "practice", gk: "practice" },
      ]},
    ]
  };
}

// ════════════════════════════════════════
// STORAGE (localStorage)
// ════════════════════════════════════════
var STORAGE_KEY = "medico-pratica";
var NAME_KEY = "medico-pratica-name";
var MATERIALS_KEY = "medico-pratica-materials";
var FLASHCARDS_KEY = "medico-pratica-flashcards";

// Intervalos de repetição espaçada (em dias)
var SPACED_INTERVALS = [1, 3, 7, 14, 30, 60];

function loadFlashcards() {
  try { return JSON.parse(localStorage.getItem(FLASHCARDS_KEY) || "[]"); } catch(e) { return []; }
}

function saveFlashcards(cards) {
  try { localStorage.setItem(FLASHCARDS_KEY, JSON.stringify(cards)); } catch(e) {}
}

function addFlashcards(newCards) {
  var existing = loadFlashcards();
  var now = new Date().toISOString().slice(0, 10);
  var toAdd = newCards.map(function(c) {
    return {
      id: Date.now() + Math.floor(Math.random() * 10000),
      frente: c.frente,
      verso: c.verso,
      tema: c.tema || "",
      nextReview: now,
      interval: 0,
      reviews: 0,
      created: now
    };
  });
  saveFlashcards(existing.concat(toAdd));
  return toAdd.length;
}

function getCardsForReview() {
  var cards = loadFlashcards();
  var today = new Date().toISOString().slice(0, 10);
  return cards.filter(function(c) { return c.nextReview <= today; });
}

function reviewCard(cardId, remembered) {
  var cards = loadFlashcards();
  var idx = cards.findIndex(function(c) { return c.id === cardId; });
  if (idx < 0) return;
  var card = Object.assign({}, cards[idx]);
  if (remembered) {
    card.interval = Math.min(card.interval + 1, SPACED_INTERVALS.length - 1);
  } else {
    card.interval = 0;
  }
  card.reviews++;
  var days = SPACED_INTERVALS[card.interval];
  var next = new Date();
  next.setDate(next.getDate() + days);
  card.nextReview = next.toISOString().slice(0, 10);
  cards[idx] = card;
  saveFlashcards(cards);
}
var FEEDBACK_KEY = "medico-pratica-feedback";

function loadFeedbacks() {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]"); } catch(e) { return []; }
}
function saveFeedback(fb) {
  var list = loadFeedbacks();
  list.push({ text: fb, date: new Date().toISOString() });
  if (list.length > 20) list = list.slice(-20);
  try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list)); } catch(e) {}
}
function getFeedbackPrompt() {
  var list = loadFeedbacks();
  if (!list.length) return "";
  var recent = list.slice(-5).map(function(f) { return f.text; }).join("; ");
  return "\nFEEDBACK DO ALUNO (leve em conta ao gerar o conteúdo): " + recent + "\n";
}

function saveToStorage(data) {
  // Protege contra sobrescrita com dados vazios
  var hasProgress = false;
  if (data.watchedState) {
    Object.keys(data.watchedState).forEach(function(k) {
      if (data.watchedState[k] && data.watchedState[k].length > 0) hasProgress = true;
    });
  }
  if (data.ct && Object.keys(data.ct).length > 0) hasProgress = true;
  if (data.topicLevels && Object.keys(data.topicLevels).length > 0) hasProgress = true;
  // Se não tem progresso, só salva se não existir dados anteriores
  if (!hasProgress) {
    var existing = null;
    try { existing = localStorage.getItem(STORAGE_KEY); } catch(e) {}
    if (existing && existing !== "null") return;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}

// ════════════════════════════════════════
// REDUCER
// ════════════════════════════════════════
function appReducer(state, action) {
  var next;
  switch (action.type) {
    case "LOADED":
      return Object.assign({}, state, action.data, { ready: true });

    case "TOGGLE_LESSON": {
      var ws = Object.assign({}, state.watchedState);
      ws[action.modId] = (ws[action.modId] || []).slice();
      var idx = ws[action.modId].indexOf(action.idx);
      if (idx >= 0) { ws[action.modId].splice(idx, 1); }
      else { ws[action.modId].push(action.idx); }
      next = Object.assign({}, state, { watchedState: ws });
      break;
    }
    case "SET_WEEK":
      next = Object.assign({}, state, { cw: action.value });
      break;

    case "TOGGLE_TASK": {
      var ct = Object.assign({}, state.ct);
      if (ct[action.key]) { delete ct[action.key]; }
      else { ct[action.key] = true; }
      next = Object.assign({}, state, { ct: ct });
      break;
    }
    case "SET_TOPIC_LEVELS": {
      var tl = typeof action.value === "function" ? action.value(state.topicLevels) : action.value;
      next = Object.assign({}, state, { topicLevels: tl });
      break;
    }
    case "SET_ERROR_BANK": {
      var eb = typeof action.value === "function" ? action.value(state.errorBank) : action.value;
      next = Object.assign({}, state, { errorBank: eb });
      break;
    }
    default:
      return state;
  }
  // Salvar após cada ação do usuário
  saveToStorage({
    watchedState: next.watchedState,
    topicLevels: next.topicLevels,
    errorBank: next.errorBank,
    ct: next.ct,
    cw: next.cw,
  });
  return next;
}

var defWatched = buildDefaultWatched();
// Seg (d0) e Ter (d1) da semana 1 marcadas como perdidas (configuração do app)
var SKIPPED_TASKS = {
  "w1-d0-b0": true, "w1-d0-b1": true, "w1-d0-b2": true,
  "w1-d1-b0": true, "w1-d1-b1": true,
};
var INITIAL_STATE = {
  watchedState: defWatched,
  topicLevels: {},
  errorBank: {},
  ct: SKIPPED_TASKS,
  cw: getFirstIncompleteWeek(defWatched),
  ready: false,
};

// ════════════════════════════════════════
// POMODORO TIMER COMPONENT
// ════════════════════════════════════════
function parseDur(dur) {
  var h = parseFloat(dur);
  return isNaN(h) ? 25 * 60 : Math.round(h * 60) * 60;
}

function PomodoroTimer({ dur, label, color, onClose }) {
  var totalSec = parseDur(dur);
  var [remaining, setRemaining] = useState(totalSec);
  var [running, setRunning] = useState(false);
  var [mode, setMode] = useState("focus"); // focus | break
  var breakTime = 5 * 60;

  useEffect(function() {
    if (!running) return;
    var id = setInterval(function() {
      setRemaining(function(r) {
        if (r <= 1) {
          clearInterval(id);
          setRunning(false);
          if (mode === "focus") {
            try {
              var ctx = new (window.AudioContext || window.webkitAudioContext)();
              function beep(time, freq, dur) {
                var o = ctx.createOscillator();
                var g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.frequency.value = freq;
                o.type = "sine";
                g.gain.setValueAtTime(0.3, ctx.currentTime + time);
                g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + dur);
                o.start(ctx.currentTime + time);
                o.stop(ctx.currentTime + time + dur);
              }
              beep(0, 880, 0.3); beep(0.4, 880, 0.3); beep(0.8, 880, 0.3);
              beep(1.4, 1100, 0.5);
            } catch(e) {}
            return 0;
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return function() { clearInterval(id); };
  }, [running, mode]);

  var min = Math.floor(remaining / 60);
  var sec = remaining % 60;
  var pct = mode === "focus" ? (1 - remaining / totalSec) * 100 : (1 - remaining / breakTime) * 100;

  function reset() { setRemaining(totalSec); setRunning(false); setMode("focus"); }
  function startBreak() { setMode("break"); setRemaining(breakTime); setRunning(true); }

  var [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 3000, background: "#0F1117", borderRadius: 16, border: "1px solid " + (mode === "focus" ? color : "#06D6A0") + "40", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", cursor: "pointer" }} onClick={function() { setMinimized(false); }}>
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="16" cy="16" r="14" fill="none" stroke={mode === "focus" ? color : "#06D6A0"} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 14}
            strokeDashoffset={2 * Math.PI * 14 * (1 - pct / 100)}
            transform="rotate(-90 16 16)"
          />
        </svg>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F0F2F5", fontFamily: "'Outfit', sans-serif" }}>
            {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
          </div>
          <div style={{ fontSize: 10, color: "#555", fontWeight: 600 }}>{label}</div>
        </div>
        <button onClick={function(e) { e.stopPropagation(); setRunning(!running); }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: running ? "rgba(255,77,109,0.15)" : (color + "20"), color: running ? "#FF4D6D" : color, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          {running ? "⏸" : "▶"}
        </button>
        <button onClick={function(e) { e.stopPropagation(); onClose(); }} style={{ padding: "6px 8px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.04)", color: "#555", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 3000, background: "#0F1117", borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", padding: "24px 24px 20px", textAlign: "center", boxShadow: "0 12px 48px rgba(0,0,0,0.7)", width: 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: mode === "focus" ? color : "#06D6A0", textTransform: "uppercase", letterSpacing: 2 }}>
          {mode === "focus" ? "Foco" : "Pausa"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={function() { setMinimized(true); }} title="Minimizar" style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "#555", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>—</button>
          <button onClick={onClose} title="Fechar" style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "#555", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 16, fontWeight: 600 }}>{label}</div>

      {/* Circular progress */}
      <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 16px" }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
          <circle cx="60" cy="60" r="54" fill="none" stroke={mode === "focus" ? color : "#06D6A0"} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 54}
            strokeDashoffset={2 * Math.PI * 54 * (1 - pct / 100)}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 0.5s" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#F0F2F5", fontFamily: "'Outfit', sans-serif", letterSpacing: -1 }}>
            {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
          </div>
          <div style={{ fontSize: 10, color: "#444", fontWeight: 600, marginTop: 2 }}>{dur} total</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 8 }}>
        <button onClick={function() { setRunning(!running); }} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: running ? "rgba(255,77,109,0.15)" : (color + "20"), color: running ? "#FF4D6D" : color, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          {running ? "⏸ Pausar" : remaining === 0 ? "✓ Fim!" : "▶ Iniciar"}
        </button>
        <button onClick={reset} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "#666", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          ↺
        </button>
      </div>

      {/* Break button */}
      {remaining === 0 && mode === "focus" && (
        <button onClick={startBreak} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(6,214,160,0.2)", background: "rgba(6,214,160,0.08)", color: "#06D6A0", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
          ☕ Pausa 5 min
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// FLASHCARDS COMPONENT
// ════════════════════════════════════════
function Flashcards({ errorBank, watchedState, materials, onClose }) {
  var [cards, setCards] = useState(null);
  var [index, setIndex] = useState(0);
  var [flipped, setFlipped] = useState(false);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState(null);
  var [done, setDone] = useState(false);

  var col = "#4CC9F0";

  useEffect(function() { generate(); }, []);

  function getTopics() {
    var errTopics = Object.keys(errorBank).filter(function(t) { return errorBank[t] > 0; });
    if (errTopics.length >= 3) return errTopics.slice(0, 6);
    var allTopics = [];
    MODULES.forEach(function(m) {
      (watchedState[m.id] || []).forEach(function(i) {
        var t = getUniqueTopicFromLesson(m.lessons[i]);
        if (!allTopics.includes(t)) allTopics.push(t);
      });
    });
    return errTopics.concat(allTopics.filter(function(t) { return !errTopics.includes(t); })).slice(0, 6);
  }

  function generate() {
    setLoading(true);
    setError(null);
    setCards(null);
    setIndex(0);
    setFlipped(false);
    setDone(false);
    var topics = getTopics();
    if (!topics.length && !(materials && materials.length)) { setError("Assista algumas aulas ou adicione materiais primeiro."); setLoading(false); return; }
    var errTopics = Object.keys(errorBank).filter(function(t) { return errorBank[t] > 0; }).sort(function(a,b) { return (errorBank[b]||0) - (errorBank[a]||0); });
    var materialExcerpt = "";
    if (materials && materials.length) {
      materialExcerpt = materials.slice(0, 3).map(function(m) { return m.content.slice(0, 1500); }).join("\n---\n");
    }
    var allTopics = errTopics.concat(topics).slice(0, 5).join(", ") || "emergências médicas";
    var matRef = materialExcerpt ? '\n\nUSE O SEGUINTE MATERIAL DO ALUNO COMO BASE PRINCIPAL para criar os flashcards (adapte ao contexto de emergência):\n' + materialExcerpt + '\n' : '';
    var prompt = 'Crie 6 flashcards de medicina sobre: ' + allTopics + '.' + matRef + '\nAPENAS JSON: {"flashcards":[{"frente":"pergunta","verso":"resposta"}]}';
    fetchAI({ max_tokens: 1200, messages: [{ role: "user", content: prompt }] })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var txt = d.content.map(function(x) { return x.text || ""; }).join("\n");
      var parsed = extractJSON(txt);
      setCards(parsed.flashcards);
      setLoading(false);
    })
    .catch(function() { setError("Erro ao gerar flashcards. Tente novamente."); setLoading(false); });
  }

  var modalStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };
  var panelStyle = { background: "#0F1117", borderRadius: 24, maxWidth: 560, width: "100%", maxHeight: "88vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.07)" };

  function Header() {
    return (
      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg," + col + "10,transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: col + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🃏</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F0F2F5" }}>Flashcards</div>
            <div style={{ fontSize: 12, color: col, fontWeight: 600, marginTop: 1, opacity: 0.8 }}>Revisão com IA</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#666", width: 32, height: 32, borderRadius: 10, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
    );
  }

  if (loading) return (
    <div onClick={onClose} style={modalStyle}>
      <div onClick={function(e){e.stopPropagation();}} style={panelStyle}>
        <Header />
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: "3px solid " + col + "30", borderTopColor: col, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: "#555", fontSize: 13, fontWeight: 600 }}>Gerando flashcards...</div>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div onClick={onClose} style={modalStyle}>
      <div onClick={function(e){e.stopPropagation();}} style={panelStyle}>
        <Header />
        <div style={{ padding: 32, textAlign: "center" }}>
          <div style={{ color: "#FF4D6D", marginBottom: 16, fontSize: 14 }}>{error}</div>
          <button onClick={onClose} style={{ padding: "10px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
        </div>
      </div>
    </div>
  );

  if (done) return (
    <div onClick={onClose} style={modalStyle}>
      <div onClick={function(e){e.stopPropagation();}} style={panelStyle}>
        <Header />
        <div style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#F0F2F5", marginBottom: 8 }}>Revisão concluída!</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>Você revisou {cards.length} flashcards</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={generate} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: col, color: "#0F1117", fontWeight: 700, cursor: "pointer" }}>🔄 Novos cards</button>
            <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!cards) return null;
  var card = cards[index];

  return (
    <div onClick={onClose} style={modalStyle}>
      <div onClick={function(e){e.stopPropagation();}} style={panelStyle}>
        <Header />
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {cards.map(function(_, i) { return <div key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, background: i < index ? "#06D6A0" : i === index ? col : "rgba(255,255,255,0.08)" }} />; })}
            </div>
            <span style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>{index + 1} / {cards.length}</span>
          </div>

          <div onClick={function() { setFlipped(!flipped); }} style={{ cursor: "pointer", minHeight: 200, borderRadius: 18, border: "1px solid " + (flipped ? col + "40" : "rgba(255,255,255,0.07)"), background: flipped ? col + "08" : "rgba(255,255,255,0.02)", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transition: "all 0.3s ease", position: "relative" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: flipped ? col : "#444", marginBottom: 16 }}>{flipped ? "RESPOSTA" : "PERGUNTA — clique para revelar"}</div>
            <div style={{ fontSize: flipped ? 13 : 15, color: flipped ? "#8B99B0" : "#F0F2F5", lineHeight: 1.8, fontWeight: flipped ? 400 : 600 }}>{flipped ? card.verso : card.frente}</div>
          </div>

          {flipped && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={function() { if (index < cards.length - 1) { setIndex(index + 1); setFlipped(false); } else { setDone(true); } }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "rgba(6,214,160,0.12)", color: "#06D6A0", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>✅ Sabia</button>
              <button onClick={function() { if (index < cards.length - 1) { setIndex(index + 1); setFlipped(false); } else { setDone(true); } }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "rgba(255,77,109,0.12)", color: "#FF4D6D", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>❌ Não sabia</button>
            </div>
          )}
          {!flipped && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <span style={{ fontSize: 12, color: "#333" }}>Toque no card para ver a resposta</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// FEEDBACK BOX (reutilizável)
// ════════════════════════════════════════
function FeedbackBox({ color }) {
  var [fb, setFb] = useState("");
  var [sent, setSent] = useState(false);
  if (sent) return <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(6,214,160,0.08)", border: "1px solid rgba(6,214,160,0.15)", fontSize: 12, color: "#06D6A0", fontWeight: 600, textAlign: "center" }}>Feedback salvo! Será usado nas próximas atividades.</div>;
  return (
    <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 8 }}>💬 FEEDBACK (opcional)</div>
      <textarea value={fb} onChange={function(e) { setFb(e.target.value); }} placeholder="Ex: Quero mais questões sobre dosagem, explicações mais curtas, casos mais difíceis..." style={{ width: "100%", minHeight: 50, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#D0D8E8", fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
      {fb.trim() && <button onClick={function() { saveFeedback(fb.trim()); setSent(true); }} style={{ marginTop: 8, padding: "6px 16px", borderRadius: 8, border: "none", background: color || "#4CC9F0", color: "#0F1117", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Enviar feedback</button>}
    </div>
  );
}

// ════════════════════════════════════════
// PRACTICE COMPONENT
// ════════════════════════════════════════
function Practice({ mod, mode, onClose, topicLevels, dispatch, errorBank, watchedState, materials }) {
  var col = mod.color;
  var [loading, setLoading] = useState(false);
  var [questions, setQuestions] = useState(null);
  var [qIndex, setQIndex] = useState(0);
  var [selected, setSelected] = useState(null);
  var [revealed, setRevealed] = useState(false);
  var [score, setScore] = useState({ correct: 0, total: 0 });
  var [error, setError] = useState(null);
  var [caseData, setCaseData] = useState(null);
  var [userAnswer, setUserAnswer] = useState("");
  var [caseFeedback, setCaseFeedback] = useState(null);
  var [caseStep, setCaseStep] = useState(0);
  var [caseScores, setCaseScores] = useState([]);
  var [caseResult, setCaseResult] = useState(null);
  var [caseTopic, setCaseTopic] = useState("");

  var isCase = mode === "cases";
  var isSimulation = mode === "simulation";
  var numQuestions = isSimulation ? 10 : 1;
  var titles = { questions: "Questões Adaptativas", cases: "Caso Clínico", simulation: "Simulado (10 questões)" };
  var icons = { questions: "📝", cases: "🏥", simulation: "🎯" };

  function getDiff(topic) { return getDiffFromLevel(topicLevels, topic); }

  function buildTopicMix() {
    var ws = watchedState || {};
    var current = [];
    (ws[mod.id] || []).forEach(function(i) {
      var t = getUniqueTopicFromLesson(mod.lessons[i]);
      if (!current.includes(t)) current.push(t);
    });
    var review = [];
    MODULES.forEach(function(m) {
      if (m.id === mod.id) return;
      (ws[m.id] || []).forEach(function(i) {
        var t = getUniqueTopicFromLesson(m.lessons[i]);
        if (!review.includes(t)) review.push(t);
      });
    });
    return { current: current, review: review };
  }

  var generate = useCallback(function() {
    setLoading(true);
    setError(null);
    setCaseScores([]);
    setCaseResult(null);
    var mix = buildTopicMix();
    // Usa todos os temas do módulo atual (não só os marcados) + revisão
    var modTopics = (mod.topics || []).slice();
    var allTopicPool = modTopics.concat(mix.review).sort(function() { return Math.random() - 0.5; });
    // Remove duplicatas
    var seen = {};
    allTopicPool = allTopicPool.filter(function(t) { if (seen[t]) return false; seen[t] = true; return true; });
    var cp, rp;
    if (numQuestions <= 2) {
      var picked = allTopicPool.slice(0, numQuestions);
      cp = picked;
      rp = [];
    } else {
      var half = Math.ceil(numQuestions / 2);
      cp = modTopics.sort(function() { return Math.random() - 0.5; }).slice(0, half);
      rp = mix.review.sort(function() { return Math.random() - 0.5; }).slice(0, numQuestions - cp.length);
      if (!cp.length) cp.push.apply(cp, rp.slice(0, half));
    }
    var td = cp.concat(rp).map(function(t) { return t + " (" + DIFF_LABELS[getDiff(t)] + ")"; });
    var ebKeys = Object.keys(errorBank).filter(function(t) { return errorBank[t] > 0; });
    var ebTxt = ebKeys.length ? "\n\nIMPORTANTE: Inclua 1-2 questões sobre estes temas (erros anteriores): " + ebKeys.join(", ") : "";

    // Monta trecho dos materiais do aluno para enriquecer as questões
    var matRef = "";
    if (materials && materials.length) {
      var matExcerpts = materials.slice(0, 3).map(function(m) { return "### " + m.title + "\n" + m.content.slice(0, 2000); }).join("\n---\n");
      matRef = "\n\nMATERIAL DE ESTUDO DO ALUNO (use como base principal para criar questões mais fiéis ao conteúdo estudado):\n" + matExcerpts + "\n";
    }

    var prompt;
    if (isCase) {
      var allTopics = cp.concat(rp);
      var topic = ebKeys.length
        ? ebKeys.sort(function(a,b){ return (errorBank[b]||0)-(errorBank[a]||0); })[0]
        : (allTopics[0] || "Emergências");
      var diff = DIFF_LABELS[getDiff(topic)];
      setCaseTopic(topic);
      prompt = 'Você é preceptor de emergência em UPA no Brasil. Crie 1 caso clínico sobre "' + topic + '", nível ' + diff + '.\nUse terminologia médica correta, sinais vitais realistas, recursos do SUS/RENAME. Respostas devem diferenciar dos principais diagnósticos diferenciais.' + matRef + '\nAPENAS JSON: {"caso":{"titulo":"titulo","tema":"' + topic + '","dificuldade":"' + diff + '","historia":"3 parágrafos com caso realista em UPA","pergunta_1":"Hipótese diagnóstica principal e por quê?","pergunta_2":"Exames disponíveis na UPA e achados esperados?","pergunta_3":"Conduta completa (estabilização, medicações, transferência)?","resposta_1":"resposta completa","resposta_2":"resposta completa","resposta_3":"resposta completa"}}';
    } else {
      var topics = cp.concat(rp).slice(0, 4).join(", ") || "emergências médicas";
      var seed = Math.floor(Math.random() * 9999);
      prompt = '[Sessão #' + seed + '] Você é preceptor de emergência em UPA no Brasil. Crie ' + numQuestions + ' questões ORIGINAIS e DIFERENTES das anteriores sobre: ' + topics + '.' + ebTxt + matRef +
        '\nREGRAS OBRIGATÓRIAS:' +
        '\n- Terminologia médica correta (PCR=Parada Cardiorrespiratória, derivações no ECG, não dermatomas)' +
        '\n- PROIBIDO alternativas tipo "todas as anteriores", "nenhuma das anteriores" ou "A e B estão corretas"' +
        '\n- 4 alternativas distintas, cada uma um diagnóstico/conduta diferente e plausível' +
        '\n- Enunciado com caso clínico curto incluindo sinais vitais quando aplicável' +
        '\n- Explicação deve dizer por que a correta é certa E por que cada errada está errada' +
        '\n- O enunciado deve ser coerente com a resposta correta. Não forneça informações no enunciado que contradigam ou tornem desnecessária a resposta correta' +
        '\n- Varie subtópicos: diagnóstico, conduta, fisiopatologia, farmacologia' +
        '\nAPENAS JSON: {"questoes":[{"enunciado":"caso clínico","alternativas":["A)...","B)...","C)...","D)..."],"correta":0,"explicacao":"explicação completa","tema":"nome","dificuldade":"Muito Fácil|Fácil|Moderado|Difícil|Muito Difícil|Impossível"}]}';
    }

    fetchAI({ max_tokens: 2000, messages: [{ role: "user", content: prompt }] })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.error) { console.error("API error:", d.error); throw new Error(d.error); }
      var txt = (d.content || []).map(function(x) { return x.text || ""; }).join("\n");
      if (!txt.trim()) throw new Error("Resposta vazia da API");
      var parsed = extractJSON(txt);
      if (isCase) { setCaseData(parsed.caso); setCaseStep(0); }
      else { setQuestions(parsed.questoes); setQIndex(0); setSelected(null); setRevealed(false); setScore({ correct: 0, total: 0 }); }
      setLoading(false);
    })
    .catch(function(err) { console.error("Erro ao gerar:", err); setError("Erro ao gerar. Tente novamente."); setLoading(false); });
  }, [isCase, numQuestions, mod, materials]);

  useEffect(function() { generate(); }, []);

  // Armazena respostas do simulado para corrigir no final
  var [simAnswers, setSimAnswers] = useState({});

  function handleAnswer(idx) {
    if (isSimulation) {
      // Simulado: só salva a resposta, sem revelar
      setSimAnswers(function(prev) { var n = Object.assign({}, prev); n[qIndex] = idx; return n; });
      if (qIndex < questions.length - 1) {
        setQIndex(qIndex + 1);
      }
      return;
    }
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    var q = questions[qIndex];
    var ok = idx === q.correta;
    var topic = q.tema || "Geral";
    setScore(function(s) { return ok ? { correct: s.correct + 1, total: s.total + 1 } : { correct: s.correct, total: s.total + 1 }; });
    if (ok) {
      dispatch({ type: "SET_TOPIC_LEVELS", value: function(p) {
        var n = Object.assign({}, p);
        var cur = n[topic] && typeof n[topic] === "object" ? Object.assign({}, n[topic]) : { nivel: 0, pontos: 0 };
        cur.pontos = (cur.pontos || 0) + 1;
        var needed = DIFF_POINTS[cur.nivel] || 1;
        if (cur.pontos >= needed && cur.nivel < 5) {
          cur.nivel++;
          cur.pontos = 0;
        }
        n[topic] = cur;
        return n;
      }});
      dispatch({ type: "SET_ERROR_BANK", value: function(p) { var n = Object.assign({}, p); if (n[topic] > 0) n[topic]--; return n; } });
    } else {
      dispatch({ type: "SET_TOPIC_LEVELS", value: function(p) {
        var n = Object.assign({}, p);
        var cur = n[topic] && typeof n[topic] === "object" ? Object.assign({}, n[topic]) : { nivel: 0, pontos: 0 };
        if (cur.nivel > 0) {
          cur.nivel--;
          cur.pontos = 0;
        } else {
          cur.pontos = 0;
        }
        n[topic] = cur;
        return n;
      }});
      dispatch({ type: "SET_ERROR_BANK", value: function(p) { var n = Object.assign({}, p); n[topic] = (n[topic] || 0) + 1; return n; } });
    }
  }

  // Finalizar simulado: corrigir tudo de uma vez
  var [simFinished, setSimFinished] = useState(false);
  function finishSimulation() {
    var correct = 0;
    questions.forEach(function(q, i) {
      var ok = simAnswers[i] === q.correta;
      var topic = q.tema || "Geral";
      if (ok) {
        correct++;
        dispatch({ type: "SET_TOPIC_LEVELS", value: function(p) {
          var n = Object.assign({}, p);
          var cur = n[topic] && typeof n[topic] === "object" ? Object.assign({}, n[topic]) : { nivel: 0, pontos: 0 };
          cur.pontos = (cur.pontos || 0) + 1;
          var needed = DIFF_POINTS[cur.nivel] || 1;
          if (cur.pontos >= needed && cur.nivel < 5) {
            cur.nivel++;
            cur.pontos = 0;
          }
          n[topic] = cur;
          return n;
        }});
        dispatch({ type: "SET_ERROR_BANK", value: function(p) { var n = Object.assign({}, p); if (n[topic] > 0) n[topic]--; return n; } });
      } else {
        dispatch({ type: "SET_TOPIC_LEVELS", value: function(p) {
          var n = Object.assign({}, p);
          var cur = n[topic] && typeof n[topic] === "object" ? Object.assign({}, n[topic]) : { nivel: 0, pontos: 0 };
          if (cur.nivel > 0) {
            cur.nivel--;
            cur.pontos = 0;
          } else {
            cur.pontos = 0;
          }
          n[topic] = cur;
          return n;
        }});
        dispatch({ type: "SET_ERROR_BANK", value: function(p) { var n = Object.assign({}, p); n[topic] = (n[topic] || 0) + 1; return n; } });
      }
    });
    setScore({ correct: correct, total: questions.length });
    setSimFinished(true);
  }

  function submitCase() {
    if (!userAnswer.trim()) return;
    setLoading(true);
    var q = caseData["pergunta_" + (caseStep + 1)];
    var a = caseData["resposta_" + (caseStep + 1)];
    var topic = caseTopic || caseData.tema || "Geral";
    fetchAI({ max_tokens: 800, messages: [{ role: "user", content: 'Avalie a resposta do aluno. Pergunta: ' + q + ' | Resposta correta: ' + a + ' | Resposta do aluno: ' + userAnswer + ' | APENAS JSON: {"avaliacao":"correta|parcial|incorreta","nota":0,"feedback":"feedback curto","resposta_ideal":"resposta ideal curta"}' }] })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var txt = d.content.map(function(x) { return x.text || ""; }).join("\n");
      var fb = extractJSON(txt);
      var nota = typeof fb.nota === "number" ? fb.nota : (fb.avaliacao === "correta" ? 9 : fb.avaliacao === "parcial" ? 6 : 3);
      var newScores = caseScores.concat([nota]);
      setCaseScores(newScores);
      setCaseFeedback(fb);
      // Se foi a última etapa, calcular resultado final e atualizar adaptive
      if (caseStep === 2) {
        var avg = Math.round(newScores.reduce(function(s,n){ return s+n; }, 0) / newScores.length);
        setCaseResult({ avg: avg, scores: newScores, topic: topic });
        if (avg >= 7) {
          dispatch({ type: "SET_TOPIC_LEVELS", value: function(p) {
            var n = Object.assign({}, p);
            var cur = n[topic] && typeof n[topic] === "object" ? Object.assign({}, n[topic]) : { nivel: 0, pontos: 0 };
            cur.pontos = (cur.pontos || 0) + 2;
            var needed = DIFF_POINTS[cur.nivel] || 1;
            while (cur.pontos >= needed && cur.nivel < 5) {
              cur.pontos -= needed;
              cur.nivel++;
              needed = DIFF_POINTS[cur.nivel] || 1;
            }
            n[topic] = cur;
            return n;
          }});
          dispatch({ type: "SET_ERROR_BANK", value: function(p) { var n = Object.assign({}, p); if ((n[topic]||0) > 0) n[topic] = Math.max(0, (n[topic]||0) - 1); return n; } });
        } else if (avg < 5) {
          dispatch({ type: "SET_TOPIC_LEVELS", value: function(p) {
            var n = Object.assign({}, p);
            var cur = n[topic] && typeof n[topic] === "object" ? Object.assign({}, n[topic]) : { nivel: 0, pontos: 0 };
            if (cur.nivel > 0) { cur.nivel--; cur.pontos = 0; } else { cur.pontos = 0; }
            n[topic] = cur;
            return n;
          }});
          dispatch({ type: "SET_ERROR_BANK", value: function(p) { var n = Object.assign({}, p); n[topic] = (n[topic]||0) + 1; return n; } });
        }
      }
      setLoading(false);
    })
    .catch(function() { setError("Erro ao avaliar."); setLoading(false); });
  }

  // ─── Modal wrapper ───
  var modalStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };
  var panelStyle = { background: "#0F1117", borderRadius: 24, maxWidth: 640, width: "100%", maxHeight: "88vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.07)" };

  function renderModal(children) {
    return (
      <div style={modalStyle}>
        <div style={panelStyle}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg," + col + "10,transparent)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: col + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icons[mode]}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F0F2F5" }}>{titles[mode]}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#666", width: 32, height: 32, borderRadius: 10, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          <div style={{ padding: "20px 24px" }}>{children}</div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading && !questions && !caseData) return renderModal(<div style={{ textAlign: "center", padding: 48 }}><div style={{ width: 44, height: 44, border: "3px solid " + col + "30", borderTopColor: col, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} /><div style={{ color: "#555", fontSize: 13, fontWeight: 600 }}>Gerando questões...</div></div>);
  if (error) return renderModal(<div style={{ textAlign: "center", padding: 32 }}><div style={{ color: "#FF4D6D", marginBottom: 16, fontSize: 14 }}>{error}</div><button onClick={generate} style={{ padding: "10px 28px", borderRadius: 12, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Tentar novamente</button></div>);

  // Simulado — correção no final
  if (isSimulation && questions && !simFinished) {
    var q = questions[qIndex];
    var answered = Object.keys(simAnswers).length;
    return renderModal(<>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#555", fontWeight: 700 }}>Questão {qIndex + 1} de {questions.length}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: col + "18", color: col }}>{answered}/{questions.length} respondidas</span>
          </div>
        </div>
        <div style={{ fontSize: 14, color: "#D0D8E8", lineHeight: 1.8, padding: "16px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 14, marginBottom: 16, borderLeft: "3px solid " + col + "40" }}>{q.enunciado}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {q.alternativas.map(function(alt, idx) {
            var isSel = simAnswers[qIndex] === idx;
            return (
              <div key={idx} onClick={function() { handleAnswer(idx); }} style={{ padding: "12px 16px", borderRadius: 12, cursor: "pointer", background: isSel ? col + "15" : "rgba(255,255,255,0.02)", border: "1px solid " + (isSel ? col : "rgba(255,255,255,0.06)"), display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: isSel ? col : "rgba(255,255,255,0.05)", color: isSel ? "#0F1117" : "#555" }}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <span style={{ fontSize: 13, color: isSel ? "#F0F2F5" : "#8B99B0", lineHeight: 1.6 }}>{alt.replace(/^[A-D]\)\s*/, "")}</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {qIndex > 0 && <button onClick={function() { setQIndex(qIndex - 1); }} style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>← Anterior</button>}
            {qIndex < questions.length - 1 && <button onClick={function() { setQIndex(qIndex + 1); }} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Próxima →</button>}
          </div>
          {answered === questions.length && <button onClick={finishSimulation} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "#06D6A0", color: "#0F1117", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>Finalizar Simulado</button>}
        </div>
        {/* Navegação rápida */}
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
          {questions.map(function(_, i) {
            var hasAnswer = simAnswers[i] !== undefined;
            return <div key={i} onClick={function() { setQIndex(i); }} style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, cursor: "pointer", background: i === qIndex ? col : hasAnswer ? "#06D6A030" : "rgba(255,255,255,0.04)", color: i === qIndex ? "#fff" : hasAnswer ? "#06D6A0" : "#444", border: "1px solid " + (i === qIndex ? col : hasAnswer ? "#06D6A030" : "rgba(255,255,255,0.06)") }}>{i + 1}</div>;
          })}
        </div>
      </>);
  }

  // Simulado — resultado final com correção
  if (isSimulation && simFinished && questions) {
    var pct = Math.round((score.correct / score.total) * 100);
    return renderModal(<>
        <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{pct >= 80 ? "🎉" : pct >= 50 ? "💪" : "📚"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#F0F2F5" }}>{score.correct}<span style={{ color: "#444" }}>/{score.total}</span></div>
          <div style={{ fontSize: 14, color: pct >= 80 ? "#06D6A0" : pct >= 50 ? "#F77F00" : "#FF4D6D", fontWeight: 700, marginTop: 4 }}>{pct}% de acerto</div>
        </div>
        <div style={{ maxHeight: 400, overflow: "auto", display: "grid", gap: 10 }}>
          {questions.map(function(q, i) {
            var userAns = simAnswers[i];
            var ok = userAns === q.correta;
            return <div key={i} style={{ padding: "14px 16px", borderRadius: 14, background: ok ? "rgba(6,214,160,0.06)" : "rgba(255,77,109,0.06)", border: "1px solid " + (ok ? "rgba(6,214,160,0.15)" : "rgba(255,77,109,0.15)") }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: ok ? "#06D6A0" : "#FF4D6D" }}>{ok ? "✅" : "❌"} Questão {i + 1}</span>
                {q.tema && <span style={{ fontSize: 11, color: "#555" }}>{q.tema}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#8B99B0", lineHeight: 1.6, marginBottom: 6 }}>{q.enunciado.slice(0, 120)}...</div>
              {!ok && <div style={{ fontSize: 12, color: "#FF4D6D", marginBottom: 4 }}>Sua: {q.alternativas[userAns] ? q.alternativas[userAns].replace(/^[A-D]\)\s*/, "") : "Não respondida"}</div>}
              <div style={{ fontSize: 12, color: "#06D6A0" }}>Correta: {q.alternativas[q.correta].replace(/^[A-D]\)\s*/, "")}</div>
              <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6, marginTop: 6 }}>{q.explicacao}</div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          <button onClick={function() { setQuestions(null); setSimAnswers({}); setSimFinished(false); generate(); }} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Novo Simulado</button>
          <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
        </div>
        <FeedbackBox color={col} />
      </>);
  }

  // Questions (modo normal — correção imediata, sem número fixo)
  if (questions && qIndex < questions.length) {
    var q = questions[qIndex];
    var qTopic = q.tema || "Geral";
    return renderModal(<>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#555", fontWeight: 700 }}>Questão {score.total + 1}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <DiffBadge topic={qTopic} topicLevels={topicLevels} />
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#06D6A018", color: "#06D6A0" }}>✓ {score.correct}/{score.total}</span>
          </div>
        </div>
        {revealed && q.tema && <div style={{ fontSize: 11, color: "#555", marginBottom: 12, fontWeight: 600 }}>Tema: <span style={{ color: col }}>{q.tema}</span></div>}
        <div style={{ fontSize: 14, color: "#D0D8E8", lineHeight: 1.8, padding: "16px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 14, marginBottom: 16, borderLeft: "3px solid " + col + "40" }}>{q.enunciado}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {q.alternativas.map(function(alt, idx) {
            var isCorrect = idx === q.correta;
            var isSelected = idx === selected;
            var bg = "rgba(255,255,255,0.02)", bc = "rgba(255,255,255,0.06)", tc = "#8B99B0";
            if (revealed && isCorrect) { bg = "rgba(6,214,160,0.1)"; bc = "#06D6A0"; tc = "#06D6A0"; }
            else if (revealed && isSelected) { bg = "rgba(255,77,109,0.1)"; bc = "#FF4D6D"; tc = "#FF4D6D"; }
            return (
              <div key={idx} onClick={function() { handleAnswer(idx); }} style={{ padding: "12px 16px", borderRadius: 12, cursor: revealed ? "default" : "pointer", background: bg, border: "1px solid " + bc, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: revealed && isCorrect ? "#06D6A0" : revealed && isSelected ? "#FF4D6D" : "rgba(255,255,255,0.05)", color: revealed && (isCorrect || isSelected) ? "#0F1117" : "#555" }}>
                  {revealed ? (isCorrect ? "✓" : isSelected ? "✗" : String.fromCharCode(65 + idx)) : String.fromCharCode(65 + idx)}
                </div>
                <span style={{ fontSize: 13, color: tc, lineHeight: 1.6 }}>{alt.replace(/^[A-D]\)\s*/, "")}</span>
              </div>
            );
          })}
        </div>
        {revealed && <div style={{ marginTop: 14, padding: 16, borderRadius: 14, background: selected === q.correta ? "rgba(6,214,160,0.06)" : "rgba(255,77,109,0.06)", border: "1px solid " + (selected === q.correta ? "rgba(6,214,160,0.15)" : "rgba(255,77,109,0.15)") }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: selected === q.correta ? "#06D6A0" : "#FF4D6D", marginBottom: 8 }}>{selected === q.correta ? "✅ Correto!" : "❌ Errou — esse tema volta para reforço"}</div>
          <div style={{ fontSize: 13, color: "#8B99B0", lineHeight: 1.7 }}>{q.explicacao}</div>
        </div>}
        {revealed && <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {qIndex < questions.length - 1
            ? <button onClick={function() { setQIndex(qIndex + 1); setSelected(null); setRevealed(false); }} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Próxima →</button>
            : <button onClick={function() { generate(); }} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Próxima →</button>
          }
        </div>}
      </>);
  }

  // Results
  if (questions && qIndex >= questions.length) {
    var pct = Math.round((score.correct / score.total) * 100);
    return renderModal(<>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{pct >= 80 ? "🎉" : pct >= 50 ? "💪" : "📚"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#F0F2F5" }}>{score.correct}<span style={{ color: "#444" }}>/{score.total}</span></div>
          <div style={{ fontSize: 14, color: pct >= 80 ? "#06D6A0" : pct >= 50 ? "#F77F00" : "#FF4D6D", fontWeight: 700, marginTop: 4 }}>{pct}% de acerto</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
            <button onClick={function() { setQuestions(null); generate(); }} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>🔄 Novas questões</button>
            <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
          </div>
        </div>
        <FeedbackBox color={col} />
      </>);
  }

  // Case result screen
  if (caseResult) {
    var avg = caseResult.avg;
    var nextDiff = avg >= 7 ? DIFF_LABELS[Math.min(5, getDiff(caseResult.topic) + 1)] : avg < 5 ? DIFF_LABELS[Math.max(0, getDiff(caseResult.topic) - 1)] : DIFF_LABELS[getDiff(caseResult.topic)];
    var medal = avg >= 9 ? "🏆" : avg >= 7 ? "🎉" : avg >= 5 ? "💪" : "📚";
    var msgColor = avg >= 7 ? "#06D6A0" : avg >= 5 ? "#F77F00" : "#FF4D6D";
    var adaptMsg = avg >= 7 ? "Próximo caso será mais difícil ↑" : avg < 5 ? "Próximo caso será mais fácil ↓" : "Dificuldade mantida →";
    return renderModal(<>
        <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>{medal}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#F0F2F5", marginBottom: 4 }}>Nota média: {avg}/10</div>
          <div style={{ fontSize: 13, color: msgColor, fontWeight: 700, marginBottom: 4 }}>{adaptMsg}</div>
          <div style={{ fontSize: 12, color: "#444", marginBottom: 20 }}>Próximo nível: {nextDiff} · Tema: {caseResult.topic}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
            {caseResult.scores.map(function(s, i) {
              var c = s >= 7 ? "#06D6A0" : s >= 5 ? "#F77F00" : "#FF4D6D";
              return <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#444", marginBottom: 4 }}>Etapa {i+1}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{s}</div>
              </div>;
            })}
          </div>
          {caseFeedback && caseFeedback.resposta_ideal && <div style={{ textAlign: "left", padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 12, marginBottom: 18, border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#444", marginBottom: 6 }}>RESPOSTA IDEAL — ETAPA FINAL</div>
            <div style={{ fontSize: 13, color: "#8B99B0", lineHeight: 1.7 }}>{caseFeedback.resposta_ideal}</div>
          </div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={function() { setCaseData(null); setCaseFeedback(null); setUserAnswer(""); setCaseResult(null); generate(); }} style={{ padding: "10px 22px", borderRadius: 12, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>🔄 Novo caso</button>
            <button onClick={onClose} style={{ padding: "10px 22px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
          </div>
        </div>
      </>);
  }

  // Case
  if (caseData) {
    var caseDiffTopic = caseTopic || caseData.tema || "Geral";
    return renderModal(<>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", flex: 1 }}>{caseData.titulo}</div>
          <DiffBadge topic={caseDiffTopic} topicLevels={topicLevels} />
        </div>
        <div style={{ fontSize: 13, color: "#8B99B0", lineHeight: 1.85, padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, marginBottom: 16, whiteSpace: "pre-wrap", borderLeft: "3px solid " + col + "40" }}>{caseData.historia}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>{[0,1,2].map(function(i) {
          var stepScore = caseScores[i];
          var sc = stepScore != null ? (stepScore >= 7 ? "#06D6A0" : stepScore >= 5 ? "#F77F00" : "#FF4D6D") : (i < caseStep ? "#06D6A0" : i === caseStep ? col : "rgba(255,255,255,0.06)");
          return <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: sc }} />;
        })}</div>
        {caseStep < 3 && <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: col, marginBottom: 12, padding: "10px 14px", background: col + "0C", borderRadius: 10, borderLeft: "3px solid " + col }}>{caseData["pergunta_" + (caseStep + 1)]}</div>
          {!caseFeedback && <div>
            <textarea value={userAnswer} onChange={function(e) { setUserAnswer(e.target.value); }} placeholder="Sua resposta..." style={{ width: "100%", minHeight: 100, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#D0D8E8", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={submitCase} disabled={loading || !userAnswer.trim()} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: userAnswer.trim() ? col : "rgba(255,255,255,0.05)", color: userAnswer.trim() ? "#fff" : "#444", fontWeight: 700, cursor: userAnswer.trim() ? "pointer" : "not-allowed" }}>{loading ? "Avaliando..." : "Enviar →"}</button>
            </div>
          </div>}
          {caseFeedback && <div>
            <div style={{ padding: 16, borderRadius: 14, marginTop: 12, background: caseFeedback.avaliacao === "correta" ? "rgba(6,214,160,0.07)" : caseFeedback.avaliacao === "parcial" ? "rgba(247,127,0,0.07)" : "rgba(255,77,109,0.07)", border: "1px solid " + (caseFeedback.avaliacao === "correta" ? "rgba(6,214,160,0.15)" : caseFeedback.avaliacao === "parcial" ? "rgba(247,127,0,0.15)" : "rgba(255,77,109,0.15)") }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{caseFeedback.avaliacao === "correta" ? "✅" : caseFeedback.avaliacao === "parcial" ? "🟡" : "❌"}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#D0D8E8" }}>Nota: {caseFeedback.nota}/10</span>
              </div>
              <div style={{ fontSize: 13, color: "#8B99B0", lineHeight: 1.7, marginBottom: caseFeedback.resposta_ideal ? 10 : 0 }}>{caseFeedback.feedback}</div>
              {caseFeedback.resposta_ideal && <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10, marginTop: 4 }}><span style={{ fontWeight: 700, color: "#444" }}>Resposta ideal: </span>{caseFeedback.resposta_ideal}</div>}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              {caseStep < 2
                ? <button onClick={function() { setCaseStep(caseStep + 1); setUserAnswer(""); setCaseFeedback(null); }} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Próxima etapa →</button>
                : <button onClick={function() { setCaseStep(3); }} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "#06D6A0", color: "#0F1117", fontWeight: 700, cursor: "pointer" }}>Ver Resultado →</button>
              }
            </div>
          </div>}
        </div>}
      </>);
  }

  return renderModal(<div style={{ color: "#555", textAlign: "center", padding: 24 }}>Carregando...</div>);
}

// ════════════════════════════════════════
// MATERIAL PRACTICE COMPONENT
// ════════════════════════════════════════
function MaterialPractice({ material, mode, onClose }) {
  var col = "#F77F00";
  var [loading, setLoading] = useState(true);
  var [questions, setQuestions] = useState(null);
  var [qIndex, setQIndex] = useState(0);
  var [selected, setSelected] = useState(null);
  var [revealed, setRevealed] = useState(false);
  var [score, setScore] = useState({ correct: 0, total: 0 });
  var [error, setError] = useState(null);

  var isFlash = mode === "flash";
  var [cards, setCards] = useState(null);
  var [cardIndex, setCardIndex] = useState(0);
  var [flipped, setFlipped] = useState(false);
  var [done, setDone] = useState(false);

  useEffect(function() { generate(); }, []);

  function generate() {
    setLoading(true); setError(null); setQuestions(null); setCards(null);
    setQIndex(0); setSelected(null); setRevealed(false); setScore({ correct: 0, total: 0 });
    setCardIndex(0); setFlipped(false); setDone(false);

    var excerpt = material.content.slice(0, 1500);
    var prompt = isFlash
      ? 'Crie 6 flashcards baseados neste texto:\n"' + excerpt + '"\nAPENAS JSON: {"flashcards":[{"frente":"pergunta","verso":"resposta"}]}'
      : 'Crie 5 questões múltipla escolha para UPA baseadas neste texto. PROIBIDO "todas as anteriores". Terminologia médica correta. Explicação deve diferenciar alternativas.\nTexto:\n"' + excerpt + '"\nAPENAS JSON: {"questoes":[{"enunciado":"caso clínico","alternativas":["A)...","B)...","C)...","D)..."],"correta":0,"explicacao":"explicação completa"}]}';

    fetchAI({ max_tokens: 1500, messages: [{ role: "user", content: prompt }] })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var txt = d.content.map(function(x) { return x.text || ""; }).join("\n");
      var parsed = extractJSON(txt);
      if (isFlash) { setCards(parsed.flashcards); }
      else { setQuestions(parsed.questoes); }
      setLoading(false);
    })
    .catch(function() { setError("Erro ao gerar. Tente novamente."); setLoading(false); });
  }

  var modalStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };
  var panelStyle = { background: "#0F1117", borderRadius: 24, maxWidth: 620, width: "100%", maxHeight: "88vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.07)" };

  function Header() {
    return (
      <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg," + col + "10,transparent)", position: "sticky", top: 0, background: "#0F1117", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: col + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{isFlash ? "🃏" : "📝"}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F5" }}>{isFlash ? "Flashcards" : "Questões"} do Material</div>
            <div style={{ fontSize: 11, color: col, fontWeight: 600, opacity: 0.8, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{material.title}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#666", width: 30, height: 30, borderRadius: 9, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
    );
  }

  if (loading) return <div style={modalStyle}><div style={panelStyle}><Header /><div style={{ padding: "48px 24px", textAlign: "center" }}><div style={{ width: 40, height: 40, border: "3px solid " + col + "30", borderTopColor: col, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} /><div style={{ color: "#555", fontSize: 13, fontWeight: 600 }}>Analisando material...</div></div></div></div>;
  if (error) return <div style={modalStyle}><div style={panelStyle}><Header /><div style={{ padding: 28, textAlign: "center" }}><div style={{ color: "#FF4D6D", marginBottom: 14, fontSize: 13 }}>{error}</div><button onClick={generate} style={{ padding: "9px 24px", borderRadius: 11, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Tentar novamente</button></div></div></div>;

  // Flashcards
  if (isFlash && cards) {
    if (done) return <div style={modalStyle}><div style={panelStyle}><Header /><div style={{ padding: "28px 22px", textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div><div style={{ fontSize: 18, fontWeight: 700, color: "#F0F2F5", marginBottom: 6 }}>Revisão concluída!</div><div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}><button onClick={generate} style={{ padding: "10px 22px", borderRadius: 11, border: "none", background: col, color: "#fff", fontWeight: 700, cursor: "pointer" }}>🔄 Novos cards</button><button onClick={onClose} style={{ padding: "10px 22px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", fontWeight: 600, cursor: "pointer" }}>Fechar</button></div></div></div></div>;
    var card = cards[cardIndex];
    return <div style={modalStyle}><div style={panelStyle}><Header />
      <div style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 5 }}>{cards.map(function(_,i){ return <div key={i} style={{ width: i===cardIndex?16:5, height: 5, borderRadius: 3, background: i<cardIndex?"#06D6A0":i===cardIndex?col:"rgba(255,255,255,0.08)" }} />; })}</div>
          <span style={{ fontSize: 11, color: "#444", fontWeight: 600 }}>{cardIndex+1}/{cards.length}</span>
        </div>
        <div onClick={function(){setFlipped(!flipped);}} style={{ cursor: "pointer", minHeight: 180, borderRadius: 16, border: "1px solid "+(flipped?col+"40":"rgba(255,255,255,0.07)"), background: flipped?col+"08":"rgba(255,255,255,0.02)", padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transition: "all 0.3s" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: flipped?col:"#444", marginBottom: 14 }}>{flipped?"RESPOSTA":"PERGUNTA — clique para revelar"}</div>
          <div style={{ fontSize: flipped?13:15, color: flipped?"#8B99B0":"#F0F2F5", lineHeight: 1.8, fontWeight: flipped?400:600 }}>{flipped?card.verso:card.frente}</div>
        </div>
        {flipped && <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={function(){ if(cardIndex<cards.length-1){setCardIndex(cardIndex+1);setFlipped(false);}else{setDone(true);}}} style={{ flex:1, padding:"11px", borderRadius:11, border:"none", background:"rgba(6,214,160,0.12)", color:"#06D6A0", fontWeight:700, cursor:"pointer", fontSize:13 }}>✅ Sabia</button>
          <button onClick={function(){ if(cardIndex<cards.length-1){setCardIndex(cardIndex+1);setFlipped(false);}else{setDone(true);}}} style={{ flex:1, padding:"11px", borderRadius:11, border:"none", background:"rgba(255,77,109,0.12)", color:"#FF4D6D", fontWeight:700, cursor:"pointer", fontSize:13 }}>❌ Não sabia</button>
        </div>}
        {!flipped && <div style={{ marginTop: 12, textAlign: "center" }}><span style={{ fontSize: 12, color: "#333" }}>Toque no card para ver a resposta</span></div>}
      </div>
    </div></div>;
  }

  // Questions
  if (questions && qIndex < questions.length) {
    var q = questions[qIndex];
    return <div style={modalStyle}><div style={panelStyle}><Header />
      <div style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>{questions.map(function(_,i){ return <div key={i} style={{ width:i===qIndex?18:5, height:5, borderRadius:3, background:i<qIndex?"#06D6A0":i===qIndex?col:"rgba(255,255,255,0.08)" }} />; })}</div>
          <span style={{ fontSize: 11, fontWeight: 700, padding:"2px 9px", borderRadius:20, background:"#06D6A018", color:"#06D6A0" }}>✓ {score.correct}/{score.total}</span>
        </div>
        <div style={{ fontSize: 13, color: "#D0D8E8", lineHeight: 1.8, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 14, borderLeft: "3px solid " + col + "40" }}>{q.enunciado}</div>
        <div style={{ display: "grid", gap: 7 }}>
          {q.alternativas.map(function(alt, idx) {
            var isCorrect = idx === q.correta, isSelected = idx === selected;
            var bg = "rgba(255,255,255,0.02)", bc = "rgba(255,255,255,0.06)", tc = "#8B99B0";
            if (revealed && isCorrect) { bg = "rgba(6,214,160,0.1)"; bc = "#06D6A0"; tc = "#06D6A0"; }
            else if (revealed && isSelected) { bg = "rgba(255,77,109,0.1)"; bc = "#FF4D6D"; tc = "#FF4D6D"; }
            return <div key={idx} onClick={function(){ if(revealed)return; setSelected(idx); setRevealed(true); var ok=idx===q.correta; setScore(function(s){ return {correct:s.correct+(ok?1:0),total:s.total+1}; }); }} style={{ padding:"11px 14px", borderRadius:11, cursor:revealed?"default":"pointer", background:bg, border:"1px solid "+bc, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:26, height:26, borderRadius:7, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, background:revealed&&isCorrect?"#06D6A0":revealed&&isSelected?"#FF4D6D":"rgba(255,255,255,0.05)", color:revealed&&(isCorrect||isSelected)?"#0F1117":"#555" }}>{revealed?(isCorrect?"✓":isSelected?"✗":String.fromCharCode(65+idx)):String.fromCharCode(65+idx)}</div>
              <span style={{ fontSize:13, color:tc, lineHeight:1.5 }}>{alt.replace(/^[A-D]\)\s*/,"")}</span>
            </div>;
          })}
        </div>
        {revealed && <div style={{ marginTop:12, padding:14, borderRadius:12, background:selected===q.correta?"rgba(6,214,160,0.06)":"rgba(255,77,109,0.06)", border:"1px solid "+(selected===q.correta?"rgba(6,214,160,0.15)":"rgba(255,77,109,0.15)") }}>
          <div style={{ fontSize:12, fontWeight:700, color:selected===q.correta?"#06D6A0":"#FF4D6D", marginBottom:6 }}>{selected===q.correta?"✅ Correto!":"❌ Incorreto"}</div>
          <div style={{ fontSize:13, color:"#8B99B0", lineHeight:1.7 }}>{q.explicacao}</div>
        </div>}
        {revealed && <div style={{ marginTop:12, display:"flex", justifyContent:"flex-end" }}>
          {qIndex < questions.length-1
            ? <button onClick={function(){ setQIndex(qIndex+1); setSelected(null); setRevealed(false); }} style={{ padding:"9px 22px", borderRadius:11, border:"none", background:col, color:"#fff", fontWeight:700, cursor:"pointer" }}>Próxima →</button>
            : <button onClick={function(){ setQIndex(questions.length); }} style={{ padding:"9px 22px", borderRadius:11, border:"none", background:"#06D6A0", color:"#0F1117", fontWeight:700, cursor:"pointer" }}>Ver Resultado</button>
          }
        </div>}
      </div>
    </div></div>;
  }

  if (questions && qIndex >= questions.length) {
    var pct = score.total > 0 ? Math.round((score.correct/score.total)*100) : 0;
    return <div style={modalStyle}><div style={panelStyle}><Header />
      <div style={{ padding:"28px 22px", textAlign:"center" }}>
        <div style={{ fontSize:44, marginBottom:10 }}>{pct>=80?"🎉":pct>=50?"💪":"📚"}</div>
        <div style={{ fontSize:26, fontWeight:800, color:"#F0F2F5" }}>{score.correct}<span style={{ color:"#444" }}>/{score.total}</span></div>
        <div style={{ fontSize:13, color:pct>=80?"#06D6A0":pct>=50?"#F77F00":"#FF4D6D", fontWeight:700, marginTop:4 }}>{pct}% de acerto</div>
        <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:22 }}>
          <button onClick={generate} style={{ padding:"9px 22px", borderRadius:11, border:"none", background:col, color:"#fff", fontWeight:700, cursor:"pointer" }}>🔄 Novas questões</button>
          <button onClick={onClose} style={{ padding:"9px 22px", borderRadius:11, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#555", fontWeight:600, cursor:"pointer" }}>Fechar</button>
        </div>
      </div>
    </div></div>;
  }

  return null;
}

// ════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════
export default function App() {
  var [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  var ws = state.watchedState;
  var topicLevels = state.topicLevels;
  var errorBank = state.errorBank;
  var ct = state.ct;
  var cw = state.cw;
  var ready = state.ready;

  var [selectedDay, setSelectedDay] = useState(null);
  var [view, setView] = useState("week");
  var [claudeExport, setClaudeExport] = useState("");
  var [claudeImport, setClaudeImport] = useState("");
  var [claudeMsg, setClaudeMsg] = useState("");
  var [claudeActivity, setClaudeActivity] = useState(null);
  var [fcCards, setFcCards] = useState(function() { return getCardsForReview(); });
  var [fcIndex, setFcIndex] = useState(0);
  var [fcFlipped, setFcFlipped] = useState(false);
  var [fcTotal, setFcTotal] = useState(function() { return loadFlashcards().length; });
  var [guideKey, setGuideKey] = useState(null);
  var [practiceMode, setPracticeMode] = useState(null);
  var [lessonModule, setLessonModule] = useState(null);
  var [showFlashcards, setShowFlashcards] = useState(false);
  var [materials, setMaterials] = useState(function() {
    try { return JSON.parse(localStorage.getItem(MATERIALS_KEY) || "[]"); } catch(e) { return []; }
  });
  var [materialsSynced, setMaterialsSynced] = useState(false);
  var [matTitle, setMatTitle] = useState("");
  var [matContent, setMatContent] = useState("");
  var [matPractice, setMatPractice] = useState(null); // { material, mode }
  var [timerBlock, setTimerBlock] = useState(null); // { dur, label, color }
  var [dragOver, setDragOver] = useState(false);
  var ZOOM_KEY = "medico-pratica-zoom";
  var [zoom, setZoom] = useState(function() {
    try { return parseFloat(localStorage.getItem(ZOOM_KEY)) || 1.15; } catch(e) { return 1.15; }
  });
  function changeZoom(delta) {
    setZoom(function(z) {
      var nz = Math.max(0.8, Math.min(1.6, Math.round((z + delta) * 100) / 100));
      try { localStorage.setItem(ZOOM_KEY, nz); } catch(e) {}
      return nz;
    });
  }

  // Sync materiais: carrega do servidor, fallback localStorage
  useEffect(function() {
    fetch((window.location.hostname === "localhost" ? "http://localhost:3001" : "") + "/api/materials")
      .then(function(r) { return r.json(); })
      .then(function(serverMats) {
        // Merge: servidor é fonte principal, localStorage é cache
        var localMats = [];
        try { localMats = JSON.parse(localStorage.getItem(MATERIALS_KEY) || "[]"); } catch(e) {}
        // Combina: materiais do servidor + locais que não existem no servidor
        var serverIds = serverMats.map(function(m) { return String(m.id); });
        var onlyLocal = localMats.filter(function(m) { return !serverIds.includes(String(m.id)); });
        // Salva materiais só-locais no servidor
        onlyLocal.forEach(function(m) {
          fetch((window.location.hostname === "localhost" ? "http://localhost:3001" : "") + "/api/materials", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(m)
          }).catch(function() {});
        });
        var merged = serverMats.concat(onlyLocal);
        setMaterials(merged);
        try { localStorage.setItem(MATERIALS_KEY, JSON.stringify(merged)); } catch(e) {}
        setMaterialsSynced(true);
      })
      .catch(function() { setMaterialsSynced(true); }); // offline: usa localStorage
  }, []);

  function saveMaterials(list) {
    setMaterials(list);
    // Protege: não sobrescreve com lista vazia se já tem dados
    if (!list.length) {
      var existing = null;
      try { existing = localStorage.getItem(MATERIALS_KEY); } catch(e) {}
      if (existing && existing !== "[]" && existing !== "null") return;
    }
    try { localStorage.setItem(MATERIALS_KEY, JSON.stringify(list)); } catch(e) {}
  }
  function addMaterial() {
    if (!matTitle.trim() || !matContent.trim()) return;
    var m = { id: Date.now(), title: matTitle.trim(), content: matContent.trim(), date: new Date().toLocaleDateString("pt-BR") };
    saveMaterials([m].concat(materials));
    // Salva no servidor
    fetch((window.location.hostname === "localhost" ? "http://localhost:3001" : "") + "/api/materials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m)
    }).catch(function() {});
    setMatTitle(""); setMatContent("");
  }
  function deleteMaterial(id) {
    saveMaterials(materials.filter(function(m){ return m.id !== id; }));
    // Remove do servidor
    fetch("http://localhost:3001/api/materials/" + id, { method: "DELETE" }).catch(function() {});
  }
  function handleFileUpload(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) { setMatContent(e.target.result); if (!matTitle) setMatTitle(file.name.replace(/\.[^.]+$/, "")); };
    reader.readAsText(file);
  }

  var [userName, setUserName] = useState(function() {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch(e) { return ""; }
  });
  var [showNameModal, setShowNameModal] = useState(false);
  var [nameInput, setNameInput] = useState("");

  // Carregar do localStorage
  useEffect(function() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        var w = d.watchedState || buildDefaultWatched();
        MODULES.forEach(function(m) { if (!(m.id in w)) w[m.id] = buildDefaultWatched()[m.id] || []; });
        dispatch({ type: "LOADED", data: { watchedState: w, topicLevels: d.topicLevels || {}, errorBank: d.errorBank || {}, ct: Object.assign({}, SKIPPED_TASKS, d.ct || {}), cw: (d.cw && !isNaN(d.cw)) ? d.cw : getFirstIncompleteWeek(w) } });
      } else {
        dispatch({ type: "LOADED", data: {} });
      }
    } catch(e) {
      dispatch({ type: "LOADED", data: {} });
    }
  }, []);

  // Loading screen
  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#0A0C10", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Newsreader', serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,700;1,400;1,700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, border: "3px solid rgba(255,77,109,0.2)", borderTopColor: "#FF4D6D", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ color: "#555", fontSize: 13, fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>Carregando...</div>
      </div>
    </div>
  );

  // Computed values
  function getWatched(id) { return ws[id] || []; }
  var totalDone = MODULES.reduce(function(s, m) { return s + getWatched(m.id).length; }, 0);
  var totalPct = Math.round((totalDone / TOTAL_LESSONS) * 100);
  var sched = makeSchedule(cw);

  // Encontra o último módulo com aulas marcadas (para questões)
  var lastActiveMod = (function() {
    for (var i = MODULES.length - 1; i >= 0; i--) {
      if (getWatched(MODULES[i].id).length > 0) return MODULES[i];
    }
    return MODULES[0];
  })();
  var totalBlocks = sched.days.reduce(function(s, d) { return s + d.blocks.length; }, 0);
  var doneBlocks = Object.keys(ct).filter(function(k) { return k.startsWith("w" + cw + "-"); }).length;
  var weekProg = doneBlocks / totalBlocks;

  var navItems = [
    { key: "week",     label: "Semana",   icon: "📅" },
    { key: "modules",  label: "Módulos",  icon: "📋" },
    { key: "claude",   label: "Atividades", icon: "🩺" },
    { key: "errors",   label: "Revisão",  icon: "🔄" },
    { key: "flashcards", label: "Flashcards", icon: "🃏" },
    { key: "material", label: "Material", icon: "📁" },
    { key: "roadmap",  label: "Trilha",   icon: "🗺️" },
    { key: "guide",    label: "Guia",     icon: "❓" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0A0C10", fontFamily: "'Outfit', sans-serif", color: "#D0D8E8", zoom: zoom }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,700;1,400;1,700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{
        "@keyframes spin { to { transform: rotate(360deg) } }" +
        "@keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }" +
        "* { box-sizing: border-box }" +
        "::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-track { background: transparent } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px }" +
        "textarea:focus { border-color: rgba(255,255,255,0.15) !important; box-shadow: 0 0 0 3px rgba(76,201,240,0.08) }"
      }</style>

      {/* Pomodoro Timer Modal */}
      {timerBlock && <PomodoroTimer dur={timerBlock.dur} label={timerBlock.label} color={timerBlock.color} onClose={function() { setTimerBlock(null); }} />}

      {/* Flashcards Modal */}
      {showFlashcards && <Flashcards errorBank={errorBank} watchedState={ws} materials={materials} onClose={function() { setShowFlashcards(false); }} />}

      {/* Material Practice Modal */}
      {matPractice && <MaterialPractice material={matPractice.material} mode={matPractice.mode} onClose={function(){ setMatPractice(null); }} />}

      {/* Name Modal */}
      {showNameModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
          <div style={{ background: "#0F1117", borderRadius: 24, maxWidth: 400, width: "100%", border: "1px solid rgba(255,255,255,0.07)", padding: "32px 28px" }}>
            <div style={{ fontSize: 28, marginBottom: 8, textAlign: "center" }}>👤</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#F0F2F5", textAlign: "center", marginBottom: 6 }}>Seu nome</div>
            <div style={{ fontSize: 13, color: "#555", textAlign: "center", marginBottom: 24 }}>Como quer ser chamado no app?</div>
            <input
              autoFocus
              value={nameInput}
              onChange={function(e) { setNameInput(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter" && nameInput.trim()) { var n = nameInput.trim(); setUserName(n); localStorage.setItem(NAME_KEY, n); setShowNameModal(false); }}}
              placeholder="Digite seu nome..."
              style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#F0F2F5", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
            />
            <button
              onClick={function() { var n = nameInput.trim(); if (!n) return; setUserName(n); localStorage.setItem(NAME_KEY, n); setShowNameModal(false); }}
              disabled={!nameInput.trim()}
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: nameInput.trim() ? "#4CC9F0" : "rgba(255,255,255,0.05)", color: nameInput.trim() ? "#0F1117" : "#444", fontWeight: 700, cursor: nameInput.trim() ? "pointer" : "not-allowed", fontSize: 14 }}
            >Salvar</button>
            {userName && <button onClick={function() { setShowNameModal(false); }} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: "#444", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancelar</button>}
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {guideKey && GUIDES[guideKey] && <div onClick={function() { setGuideKey(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
        <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "#0F1117", borderRadius: 24, maxWidth: 520, width: "100%", maxHeight: "88vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.07)", animation: "fadeIn 0.2s ease" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#F0F2F5" }}>{GUIDES[guideKey].t}</h2>
            <button onClick={function() { setGuideKey(null); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#666", width: 32, height: 32, borderRadius: 10, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          <div style={{ padding: "20px 24px 28px" }}>
            <p style={{ fontSize: 13, color: "#666", lineHeight: 1.7, margin: "0 0 20px" }}>{GUIDES[guideKey].d}</p>
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#06D6A0", marginBottom: 14, letterSpacing: "0.06em" }}>DICAS</div>
              {GUIDES[guideKey].tips.map(function(tip, i) {
                return <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: "rgba(6,214,160,0.1)", color: "#06D6A0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: "#8B99B0", lineHeight: 1.6 }}>{tip}</span>
                </div>;
              })}
            </div>
          </div>
        </div>
      </div>}

      {/* Practice Modal */}
      {practiceMode && <Practice mod={lastActiveMod} mode={practiceMode} onClose={function() { setPracticeMode(null); }} topicLevels={topicLevels} dispatch={dispatch} errorBank={errorBank} watchedState={ws} materials={materials} />}

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "0 24px", background: "rgba(10,12,16,0.9)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#4CC9F0,#7B2FBE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>👨‍⚕️</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", lineHeight: 1, fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Pronto Atendimento Suckel</div>
              {userName && <div style={{ fontSize: 11, color: "#555", marginTop: 2, fontWeight: 500 }}>Olá, {userName} 👋</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={function() { changeZoom(-0.05); }} title="Diminuir" style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#888", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontSize: 11, color: "#555", fontWeight: 700, minWidth: 36, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={function() { changeZoom(0.05); }} title="Aumentar" style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#888", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            <button onClick={function() { setNameInput(userName); setShowNameModal(true); }} title="Editar perfil" style={{ width: 32, height: 32, borderRadius: 10, background: userName ? "rgba(76,201,240,0.1)" : "rgba(255,77,109,0.12)", border: "1px solid " + (userName ? "rgba(76,201,240,0.15)" : "rgba(255,77,109,0.2)"), color: userName ? "#4CC9F0" : "#FF4D6D", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4 }}>{userName ? "✏️" : "👤"}</button>
          </div>
          <nav style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 3 }}>
            {navItems.map(function(item) {
              return <button key={item.key} onClick={function() { setView(item.key); setLessonModule(null); }} style={{ padding: "6px 14px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: view === item.key ? "rgba(255,255,255,0.08)" : "transparent", color: view === item.key ? "#F0F2F5" : "#444" }}>
                <span style={{ marginRight: 5 }}>{item.icon}</span>{item.label}
              </button>;
            })}
          </nav>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "rgba(255,255,255,0.015)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: totalPct + "%", background: "linear-gradient(90deg,#FF4D6D,#4CC9F0)", borderRadius: 2, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ fontSize: 12, color: "#444", fontWeight: 600, whiteSpace: "nowrap" }}>{totalDone}<span style={{ color: "#333" }}>/{TOTAL_LESSONS}</span> aulas · <span style={{ color: "#555" }}>{totalPct}%</span></div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 24px 80px", animation: "fadeIn 0.25s ease" }}>

        {/* ─── LESSON LIST ─── */}
        {lessonModule && <div style={{ animation: "fadeIn 0.2s ease" }}>
          <button onClick={function() { setLessonModule(null); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#D0D8E8", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 600, marginBottom: 20, fontSize: 13 }}>← Voltar</button>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: lessonModule.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{lessonModule.icon}</div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#F0F2F5" }}>{lessonModule.name}</h2>
              {(function() {
                var topics = (lessonModule.topics || []);
                var doneTops = topics.filter(function(t) {
                  var indices = [];
                  lessonModule.lessons.forEach(function(l, i) {
                    if (lessonMatchesTopic(l, t)) indices.push(i);
                  });
                  return indices.length > 0 && indices.every(function(i) { return getWatched(lessonModule.id).includes(i); });
                });
                return <div style={{ fontSize: 12, color: "#444", marginTop: 3 }}>{doneTops.length}/{topics.length} temas concluídos</div>;
              })()}
            </div>
          </div>
          {(function() {
            var topics = (lessonModule.topics || []);
            var watched = getWatched(lessonModule.id);
            var totalLessons = lessonModule.lessons.length;
            var doneLessons = watched.length;
            var pct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
            return <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ height: "100%", width: pct + "%", background: lessonModule.color, borderRadius: 2 }} />
            </div>;
          })()}
          <div style={{ display: "grid", gap: 3 }}>
            {(lessonModule.topics || []).map(function(topic) {
              // Encontra todos os índices de aulas deste tema
              var indices = [];
              lessonModule.lessons.forEach(function(l, i) {
                if (lessonMatchesTopic(l, topic)) indices.push(i);
              });
              var allDone = indices.length > 0 && indices.every(function(i) { return getWatched(lessonModule.id).includes(i); });
              var someDone = indices.some(function(i) { return getWatched(lessonModule.id).includes(i); });
              return <div key={topic} onClick={function() {
                // Toggle: marca ou desmarca todas as aulas desse tema
                indices.forEach(function(i) {
                  var isWatched = getWatched(lessonModule.id).includes(i);
                  if (allDone) {
                    if (isWatched) dispatch({ type: "TOGGLE_LESSON", modId: lessonModule.id, idx: i });
                  } else {
                    if (!isWatched) dispatch({ type: "TOGGLE_LESSON", modId: lessonModule.id, idx: i });
                  }
                });
              }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.015)", borderLeft: "2px solid " + (allDone ? "#06D6A0" : someDone ? lessonModule.color : "rgba(255,255,255,0.05)"), cursor: "pointer", opacity: allDone ? 0.5 : 1, transition: "all 0.2s" }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid " + (allDone ? "#06D6A0" : someDone ? lessonModule.color : "rgba(255,255,255,0.1)"), background: allDone ? "#06D6A0" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#0A0C10", flexShrink: 0, fontWeight: 700 }}>{allDone ? "✓" : ""}</div>
                <span style={{ fontSize: 13, fontWeight: 500, color: allDone ? "#444" : "#D0D8E8", textDecoration: allDone ? "line-through" : "none" }}>{topic}</span>
                <span style={{ fontSize: 10, color: "#444", marginLeft: "auto" }}>{indices.filter(function(i) { return getWatched(lessonModule.id).includes(i); }).length}/{indices.length}</span>
              </div>;
            })}
          </div>
        </div>}

        {/* ─── ERRORS / REVISÃO TAB ─── */}
        {!lessonModule && view === "errors" && (function() {
          var errTopics = Object.keys(errorBank).filter(function(t) { return errorBank[t] > 0; }).sort(function(a,b) { return (errorBank[b]||0) - (errorBank[a]||0); });
          var totalErrors = errTopics.reduce(function(s, t) { return s + errorBank[t]; }, 0);
          return <div style={{ animation: "fadeIn 0.2s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Revisão de Erros</h2>
              <p style={{ fontSize: 13, color: "#444", margin: 0 }}>Revise os temas que você mais errou durante a semana</p>
            </div>

            {errTopics.length === 0 && <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", marginBottom: 6 }}>Nenhum erro registrado!</div>
              <div style={{ fontSize: 13, color: "#444" }}>Pratique questões e seus erros aparecerão aqui para revisão.</div>
            </div>}

            {errTopics.length > 0 && <>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.12)" }}>
                  <div style={{ fontSize: 11, color: "#FF4D6D", fontWeight: 700, marginBottom: 4 }}>TEMAS COM ERRO</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#F0F2F5" }}>{errTopics.length}</div>
                </div>
                <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(247,127,0,0.06)", border: "1px solid rgba(247,127,0,0.12)" }}>
                  <div style={{ fontSize: 11, color: "#F77F00", fontWeight: 700, marginBottom: 4 }}>TOTAL DE ERROS</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#F0F2F5" }}>{totalErrors}</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {errTopics.map(function(topic) {
                  var count = errorBank[topic];
                  var tl = getTopicLevel(topicLevels, topic);
                  var nivel = tl.nivel;
                  var dc = DIFF_COLORS[nivel] || DIFF_COLORS[0];
                  var barWidth = Math.min(100, (count / Math.max.apply(null, errTopics.map(function(t){ return errorBank[t]; }))) * 100);
                  return <div key={topic} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F5" }}>{topic}</span>
                        <DiffBadge topic={topic} topicLevels={topicLevels} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#FF4D6D" }}>{count} {count === 1 ? "erro" : "erros"}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: "#FF4D6D", width: barWidth + "%", transition: "width 0.3s" }} />
                    </div>
                  </div>;
                })}
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button onClick={function() { setPracticeMode("questions"); }} style={{ flex: 1, padding: "12px 20px", borderRadius: 12, border: "none", background: "#FF4D6D", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Praticar temas com erro</button>
                <button onClick={function() { dispatch({ type: "SET_ERROR_BANK", value: {} }); }} style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Limpar erros</button>
              </div>
            </>}
          </div>;
        })()}

        {/* ─── FLASHCARDS TAB ─── */}
        {!lessonModule && view === "flashcards" && (function() {
          var allCards = loadFlashcards();
          var dueCards = fcCards;
          var card = dueCards[fcIndex];
          var nextReviewCards = allCards.filter(function(c) { return c.nextReview > new Date().toISOString().slice(0, 10); });

          function handleReview(remembered) {
            if (!card) return;
            reviewCard(card.id, remembered);
            setFcFlipped(false);
            if (fcIndex < dueCards.length - 1) {
              setFcIndex(fcIndex + 1);
            } else {
              setFcCards(getCardsForReview());
              setFcIndex(0);
            }
            setFcTotal(loadFlashcards().length);
          }

          function deleteCard(id) {
            var cards = loadFlashcards().filter(function(c) { return c.id !== id; });
            saveFlashcards(cards);
            setFcCards(getCardsForReview());
            setFcIndex(0);
            setFcTotal(cards.length);
          }

          return <div style={{ animation: "fadeIn 0.2s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Flashcards</h2>
              <p style={{ fontSize: 13, color: "#444", margin: 0 }}>Repetição espaçada — revise no momento certo</p>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(76,201,240,0.06)", border: "1px solid rgba(76,201,240,0.12)" }}>
                <div style={{ fontSize: 11, color: "#4CC9F0", fontWeight: 700, marginBottom: 4 }}>PARA REVISAR HOJE</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F0F2F5" }}>{dueCards.length}</div>
              </div>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(6,214,160,0.06)", border: "1px solid rgba(6,214,160,0.12)" }}>
                <div style={{ fontSize: 11, color: "#06D6A0", fontWeight: 700, marginBottom: 4 }}>TOTAL DE CARDS</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F0F2F5" }}>{fcTotal}</div>
              </div>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(224,64,251,0.06)", border: "1px solid rgba(224,64,251,0.12)" }}>
                <div style={{ fontSize: 11, color: "#E040FB", fontWeight: 700, marginBottom: 4 }}>AGENDADOS</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F0F2F5" }}>{nextReviewCards.length}</div>
              </div>
            </div>

            {/* No cards */}
            {!allCards.length && <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🃏</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", marginBottom: 6 }}>Nenhum flashcard ainda</div>
              <div style={{ fontSize: 13, color: "#444" }}>Pratique na aba Claude e importe o relatório — os flashcards dos seus erros aparecerão aqui automaticamente.</div>
            </div>}

            {/* All reviewed */}
            {allCards.length > 0 && !dueCards.length && <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#06D6A0", marginBottom: 6 }}>Tudo revisado!</div>
              <div style={{ fontSize: 13, color: "#444" }}>{nextReviewCards.length} cards agendados para os próximos dias.</div>
            </div>}

            {/* Card review */}
            {card && <div>
              <div style={{ fontSize: 12, color: "#555", fontWeight: 600, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Card {fcIndex + 1} de {dueCards.length}</span>
                {card.tema && <span style={{ color: "#4CC9F0" }}>{card.tema}</span>}
              </div>
              <div onClick={function() { setFcFlipped(!fcFlipped); }} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 20, padding: "32px 24px", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", minHeight: 160, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", transition: "all 0.2s" }}>
                {!fcFlipped && <>
                  <div style={{ fontSize: 11, color: "#555", fontWeight: 700, marginBottom: 12, letterSpacing: "0.05em" }}>PERGUNTA</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#F0F2F5", lineHeight: 1.7 }}>{card.frente}</div>
                  <div style={{ fontSize: 11, color: "#333", marginTop: 16 }}>Clique para ver a resposta</div>
                </>}
                {fcFlipped && <>
                  <div style={{ fontSize: 11, color: "#06D6A0", fontWeight: 700, marginBottom: 12, letterSpacing: "0.05em" }}>RESPOSTA</div>
                  <div style={{ fontSize: 15, color: "#8B99B0", lineHeight: 1.7 }}>{card.verso}</div>
                </>}
              </div>
              {fcFlipped && <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={function() { handleReview(false); }} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "rgba(255,77,109,0.12)", color: "#FF4D6D", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Não lembrei</button>
                <button onClick={function() { handleReview(true); }} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "rgba(6,214,160,0.12)", color: "#06D6A0", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Lembrei</button>
              </div>}
              {fcFlipped && <div style={{ fontSize: 11, color: "#333", marginTop: 8, textAlign: "center" }}>
                {"Próxima revisão: " + (card.interval === 0 ? "amanhã" : "em " + SPACED_INTERVALS[Math.min(card.interval + 1, SPACED_INTERVALS.length - 1)] + " dias se lembrar")}
                {" · Revisões: " + card.reviews}
              </div>}
            </div>}
          </div>;
        })()}

        {/* ─── CLAUDE TAB ─── */}
        {!lessonModule && view === "claude" && (function() {
          function buildStudentData(activityId) {
            var errTopics = Object.keys(errorBank).filter(function(t) { return errorBank[t] > 0; }).sort(function(a,b) { return (errorBank[b]||0) - (errorBank[a]||0); });
            var levels = {};
            // Identifica temas marcados (assistidos)
            var watchedTopics = [];
            MODULES.forEach(function(m) {
              var watched = getWatched(m.id);
              (m.topics || []).forEach(function(t) {
                var tl = getTopicLevel(topicLevels, t, activityId);
                levels[t] = { nivel: tl.nivel, pontos: tl.pontos, label: DIFF_LABELS[tl.nivel] };
                // Verifica se pelo menos uma aula desse tema foi marcada
                var hasWatched = watched.some(function(i) {
                  return lessonMatchesTopic(m.lessons[i], t);
                });
                if (hasWatched && !watchedTopics.includes(t)) watchedTopics.push(t);
              });
            });
            var modProgress = MODULES.map(function(m) { return m.name + ": " + getWatched(m.id).length + "/" + m.lessons.length; }).join("\n");
            var errTxt = errTopics.length ? errTopics.map(function(t) { return t + ": " + errorBank[t] + " erros"; }).join(", ") : "nenhum";
            // Mostra apenas temas marcados com seus níveis
            var actLabel = activityId ? (ACTIVITY_LABELS[activityId] || activityId) : "Geral";
            var levelTxt = "Atividade: " + actLabel + "\n\n" + MODULES.map(function(m) {
              var topicLines = (m.topics || []).filter(function(t) { return watchedTopics.includes(t); }).map(function(t) {
                var tl = levels[t] || { nivel: 0, pontos: 0, label: DIFF_LABELS[0] };
                var needed = DIFF_POINTS[tl.nivel];
                var circles = "";
                for (var ci = 0; ci < needed; ci++) circles += ci < tl.pontos ? "●" : "○";
                return "  - " + t + ": " + tl.label + " " + circles;
              }).join("\n");
              if (!topicLines) return null;
              return m.name + ":\n" + topicLines;
            }).filter(Boolean).join("\n\n") || "Nenhum tema marcado ainda";
            var watchedTxt = watchedTopics.join(", ") || "nenhum";
            var matTxt = materials.length ? materials.map(function(m) { return m.title + ":\n" + m.content; }).join("\n---\n") : "nenhum";
            return { errTopics: errTopics, levels: levels, modProgress: modProgress, errTxt: errTxt, levelTxt: levelTxt, matTxt: matTxt, watchedTopics: watchedTopics, watchedTxt: watchedTxt };
          }

          var allTopicNames = [];
          MODULES.forEach(function(m) { (m.topics || []).forEach(function(t) { if (!allTopicNames.includes(t)) allTopicNames.push(t); }); });
          var syncFormat = '\n\n--- INSTRUCOES INTERNAS (nao mostrar ao aluno) ---\n' +
            'REGISTRO: Mantenha internamente um registro de acertos e erros por tema ao longo da conversa. Voce vai precisar disso para gerar o sync no final.\n' +
            'NAO gere o bloco medico-sync durante a conversa. Gere APENAS quando o aluno digitar "finalizei".\n\n' +
            '--- QUANDO O ALUNO DIGITAR "finalizei" ---\n' +
            'Gere OBRIGATORIAMENTE um bloco de sync neste formato EXATO:\n```medico-sync\n{"acao":"atualizar","dados":{"niveis":{"NomeTema":{"nivel":0,"pontos":0}},"erros":{"NomeTema":0},"flashcards":[{"frente":"pergunta","verso":"resposta"}],"observacoes":"resumo do desempenho"}}\n```\n\n' +
            'SISTEMA DE PROGRESSAO (use para calcular niveis e pontos no sync):\n' +
            'Cada tema tem um NIVEL (0-5) e PONTOS acumulados dentro desse nivel.\n' +
            'Niveis: 0=Muito Facil, 1=Facil, 2=Moderado, 3=Dificil, 4=Muito Dificil, 5=Impossivel.\n' +
            'Pontos para subir: nivel 0=2pts, nivel 1=3pts, nivel 2=3pts, nivel 3=4pts, nivel 4=5pts, nivel 5=1pt.\n' +
            'ACERTO em um tema: +1 ponto. Se pontos atingem o necessario, SOBE nivel e pontos voltam a 0.\n' +
            'ERRO em um tema: VOLTA nivel anterior e pontos voltam a 0. No nivel 0 apenas zera pontos.\n' +
            'Exemplo: tema nivel 1 (Facil, precisa 3pts) com 2 pontos. Acertou = 3pts = sobe nivel 2 (Moderado) com 0pts. Se errou = volta nivel 0 (Muito Facil) com 0pts.\n' +
            'IMPORTANTE: Os niveis informados acima sao EXCLUSIVOS desta atividade. Cada atividade (Questoes, Caso Clinico, Investigacao, Reforco) tem niveis separados por tema. Atualize apenas os niveis desta atividade.\n' +
            'Parta dos niveis e pontos ATUAIS informados acima e aplique os acertos/erros da sessao para chegar ao valor FINAL.\n\n' +
            'FLASHCARDS: No campo "flashcards" do sync, gere 1 flashcard para CADA tema que o aluno ERROU na sessao. Formato: {"frente":"pergunta objetiva","verso":"resposta completa"}. Foque no ponto exato que o aluno errou.\n\n' +
            'NOMES DOS TEMAS: Use EXATAMENTE os nomes abaixo (com acentos, espacos e maiusculas). Nomes diferentes NAO serao reconhecidos pelo app:\n' + allTopicNames.join(", ");

          var activities = [
            { id: "questions", icon: "📝", title: "Questões", color: "#4CC9F0", desc: "Múltipla escolha · dificuldade ajusta ao seu nível", gen: function() {
              var sd = buildStudentData("questions");
              if (!sd.watchedTopics.length) return null;
              return [
                "=== ATIVIDADE: QUESTÕES ADAPTATIVAS ===",
                "",
                "COMPORTAMENTO: Comece IMEDIATAMENTE com a Questão 1. Sem introdução, saudação ou explicação.",
                "",
                "--- MEU PERFIL ---",
                "Estudante de medicina · Pronto atendimento · UPA Brasil",
                "",
                "--- TEMAS PERMITIDOS (use APENAS estes) ---",
                sd.watchedTxt,
                "",
                "--- MEUS NÍVEIS ---",
                sd.levelTxt,
                "",
                "--- MEUS MATERIAIS ---",
                sd.matTxt,
                "",
                "--- FORMATO DA QUESTÃO ---",
                "Questão N [Nível]",
                "",
                "Caso clínico curto com sinais vitais.",
                "",
                "A) alternativa",
                "B) alternativa",
                "C) alternativa",
                "D) alternativa",
                "",
                "--- REGRAS ---",
                "1. UMA questão por vez, numerada",
                "2. NÃO mostre o tema na questão",
                "3. Cada alternativa em sua própria linha",
                "4. ALEATORIEDADE OBRIGATÓRIA: antes de cada questão, escolha o tema de forma COMPLETAMENTE ALEATÓRIA entre TODOS os temas listados. NÃO siga a ordem da lista. NÃO repita o mesmo tema nas últimas 3 questões. NÃO fique alternando entre apenas 2-3 temas. Use o MÁXIMO de temas diferentes possível ao longo da sessão.",
                "5. Enunciado coerente com a resposta correta",
                "6. Varie: diagnóstico, conduta, fisiopatologia, farmacologia",
                "7. PROIBIDO: 'todas as anteriores', 'nenhuma das anteriores'",
                "8. Use meus materiais como base quando o tema coincidir",
                "",
                "--- APÓS EU RESPONDER ---",
                "1. Revele o TEMA",
                "2. Mostre placar (ex: 3/5)",
                "3. Mostre a progressao do tema: ANTES → DEPOIS. Parta dos pontos EXATOS informados na secao MEUS NIVEIS acima (se mostra ○○ significa 0 pontos, nao invente pontos). Formato: 'Tema [Nivel ○○] → acertou → [Nivel ●○] (1/2 para subir)' ou 'Tema [Nivel ●○] → errou → voltou para NivelAnterior [○○]'",
                "4. Explique: por que a correta é certa E por que CADA errada está errada",
                "5. Faça a próxima questão automaticamente",
              ].join("\n") + syncFormat;
            }},
            { id: "cases", icon: "🏥", title: "Caso Clínico", color: "#FF4D6D", desc: "Conduza o paciente do início ao tratamento", gen: function() {
              var sd = buildStudentData("cases");
              if (!sd.watchedTopics.length) return null;
              return [
                "=== ATIVIDADE: CASO CLÍNICO ===",
                "",
                "COMPORTAMENTO: Comece IMEDIATAMENTE com o caso. Sem introdução, saudação ou explicação.",
                "",
                "--- MEU PERFIL ---",
                "Estudante de medicina · Pronto atendimento · UPA Brasil",
                "",
                "--- TEMAS PERMITIDOS (use APENAS estes) ---",
                sd.watchedTxt,
                "",
                "--- MEUS NÍVEIS ---",
                sd.levelTxt,
                "",
                "--- MEUS MATERIAIS ---",
                sd.matTxt,
                "",
                "--- REGRAS ---",
                "1. Escolha o tema ALEATORIAMENTE da lista acima",
                "2. Crie caso clínico realista de UPA: história detalhada (3+ parágrafos), sinais vitais, exames",
                "3. Enunciado coerente com as respostas esperadas",
                "4. Terminologia médica correta, recursos do SUS/RENAME",
                "",
                "--- ETAPAS (uma por vez, espere minha resposta) ---",
                "Etapa 1: Hipótese diagnóstica principal e por quê?",
                "Etapa 2: Exames disponíveis na UPA e achados esperados?",
                "Etapa 3: Conduta completa (estabilização, medicações, transferência)?",
                "",
                "--- APÓS CADA RESPOSTA ---",
                "Avalie de 0 a 10, dê feedback, depois passe para a próxima etapa.",
              ].join("\n") + syncFormat;
            }},
            { id: "diagnostic", icon: "🔍", title: "Investigação Clínica", color: "#06D6A0", desc: "Interrogue, examine e descubra o diagnóstico", gen: function() {
              var sd = buildStudentData("diagnostic");
              if (!sd.watchedTopics.length) return null;
              return [
                "=== ATIVIDADE: DESAFIO DIAGNÓSTICO ===",
                "",
                "COMPORTAMENTO: Apresente o paciente IMEDIATAMENTE. Sem introdução, saudação ou explicação.",
                "",
                "--- MEU PERFIL ---",
                "Estudante de medicina · Diagnóstico diferencial · UPA Brasil",
                "",
                "--- TEMAS PERMITIDOS (use APENAS estes) ---",
                sd.watchedTxt,
                "",
                "--- MEUS NÍVEIS ---",
                sd.levelTxt,
                "",
                "--- MEUS MATERIAIS ---",
                sd.matTxt,
                "",
                "--- APRESENTAÇÃO INICIAL ---",
                "Dê APENAS: queixa principal, idade, sexo, como chegou na UPA.",
                "Exemplo: 'Homem, 58 anos, trazido pelo SAMU com dor torácica há 2 horas.'",
                "NÃO dê: diagnóstico, exames prontos, sinais vitais completos.",
                "",
                "--- COMO RESPONDER ---",
                "EU conduzo a investigação. Você responde APENAS o que eu perguntar:",
                "- Se eu perguntar ao paciente → responda em primeira pessoa como o paciente",
                "- Se eu pedir sinais vitais → forneça valores realistas",
                "- Se eu pedir exame → dê resultado realista e coerente com o diagnóstico",
                "- Responda APENAS o que foi solicitado, nada além",
                "",
                "--- QUANDO EU DER MINHA HIPÓTESE ---",
                "- Se acertei: peça conduta completa (medicações, doses, destino)",
                "- Se errei: dê dica sutil, deixe tentar de novo",
                "",
                "--- FINAL ---",
                "Resumo: diagnóstico correto, achados-chave, o que melhorar.",
                "Terminologia médica correta, recursos do SUS/RENAME.",
              ].join("\n") + syncFormat;
            }},
          ];

          return <div style={{ animation: "fadeIn 0.2s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Estudar com Claude</h2>
              <p style={{ fontSize: 13, color: "#444", margin: 0 }}>Escolha uma atividade, copie o prompt e cole no Claude</p>
            </div>

            {/* Atividades */}
            {!claudeExport && <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              {activities.map(function(act) {
                return <div key={act.id} onClick={function() {
                  var result = act.gen();
                  if (!result) {
                    var msg = (act.id === "review") ? "Você não tem erros registrados. Pratique questões primeiro." : "Marque pelo menos um tema nos módulos antes de usar esta atividade.";
                    setClaudeMsg(msg);
                    return;
                  }
                  setClaudeExport(result);
                  setClaudeActivity(act.id);
                  setClaudeMsg("");
                }} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: "18px 20px", border: "1px solid " + act.color + "15", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: act.color + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{act.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", marginBottom: 3 }}>{act.title}</div>
                    <div style={{ fontSize: 12, color: "#444" }}>{act.desc}</div>
                  </div>
                  <div style={{ color: act.color, fontSize: 18, opacity: 0.6 }}>→</div>
                </div>;
              })}
              {claudeMsg && !claudeExport && <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.15)", fontSize: 12, color: "#FF4D6D", lineHeight: 1.6 }}>{claudeMsg}</div>}
            </div>}

            {/* Prompt gerado */}
            {claudeExport && <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#4CC9F0" }}>Prompt gerado — copie e cole no Claude</div>
                <button onClick={function() { setClaudeExport(""); setClaudeActivity(null); setClaudeMsg(""); }} style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>← Voltar</button>
              </div>
              <textarea readOnly value={claudeExport} style={{ width: "100%", minHeight: 180, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#8B99B0", padding: 14, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical" }} onClick={function(e) { e.target.select(); }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={function() { navigator.clipboard.writeText(claudeExport); setClaudeMsg("Copiado!"); }} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#06D6A0", color: "#0F1117", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Copiar prompt</button>
                {claudeMsg === "Copiado!" && <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#06D6A0" }}>Copiado! Cole no Claude e comece.</span>}
              </div>
            </div>}

            {/* Níveis por tema */}
            {!claudeExport && (function() {
              var hasAny = false;
              var sections = MODULES.map(function(m) {
                var watched = getWatched(m.id);
                var topicsWithData = (m.topics || []).filter(function(t) {
                  return watched.some(function(i) {
                    return lessonMatchesTopic(m.lessons[i], t);
                  });
                });
                if (!topicsWithData.length) return null;
                hasAny = true;
                return { mod: m, topics: topicsWithData };
              }).filter(Boolean);
              if (!hasAny) return null;
              return <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 12, letterSpacing: "0.05em" }}>NÍVEIS POR TEMA</div>
                {sections.map(function(sec) {
                  return <div key={sec.mod.id} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: sec.mod.color, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>{sec.mod.icon} {sec.mod.name}</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {sec.topics.map(function(t) {
                        return <div key={t} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#D0D8E8", marginBottom: 8 }}>{t}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                            {ACTIVITY_TYPES.map(function(act) {
                              var tl = getTopicLevel(topicLevels, t, act);
                              var nivel = tl.nivel;
                              var pontos = tl.pontos;
                              var needed = DIFF_POINTS[nivel];
                              var dc = DIFF_COLORS[nivel];
                              var label = DIFF_LABELS[nivel];
                              var circles = [];
                              for (var ci = 0; ci < needed; ci++) {
                                circles.push(<span key={ci} style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", border: "1.5px solid " + dc, background: ci < pontos ? dc : "transparent", marginRight: 2 }} />);
                              }
                              return <div key={act} style={{ padding: "6px 8px", borderRadius: 8, background: dc + "08", textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: "#555", fontWeight: 700, marginBottom: 3, letterSpacing: "0.03em" }}>{ACTIVITY_LABELS[act]}</div>
                                <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>{circles}</div>
                                <div style={{ fontSize: 9, color: dc, fontWeight: 600 }}>{label}</div>
                              </div>;
                            })}
                          </div>
                        </div>;
                      })}
                    </div>
                  </div>;
                })}
              </div>;
            })()}

            {/* Importar */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E040FB", marginBottom: 10 }}>Importar relatório do Claude</div>
              <p style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>Quando terminar, digite "finalizei" no Claude. Cole a resposta inteira aqui — o app encontra o bloco automaticamente.</p>
              <textarea value={claudeImport} onChange={function(e) { setClaudeImport(e.target.value); setClaudeMsg(""); }} placeholder={"Cole aqui a resposta inteira do Claude..."} style={{ width: "100%", minHeight: 100, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#D0D8E8", padding: 14, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical" }} />
              <button onClick={function() {
                try {
                  var raw = claudeImport;
                  var syncMatch = raw.match(/```medico-sync\s*([\s\S]*?)```/);
                  if (!syncMatch) {
                    // Tenta achar JSON solto
                    var jsonMatch = raw.match(/\{"acao"\s*:\s*"atualizar"[\s\S]*?\}\s*\}/);
                    if (jsonMatch) syncMatch = [null, jsonMatch[0]];
                  }
                  if (!syncMatch) throw new Error("Bloco medico-sync nao encontrado na resposta. Certifique-se de digitar 'finalizei' no Claude.");
                  var jsonStr = syncMatch[1].trim();
                  var data = JSON.parse(jsonStr);
                  var d = data.dados || data;
                  var changes = [];

                  // Temas validos do app
                  var validTopics = [];
                  MODULES.forEach(function(m) { (m.topics || []).forEach(function(t) { if (!validTopics.includes(t)) validTopics.push(t); }); });
                  var ignored = [];

                  var importActivity = claudeActivity || "questions";
                  if (d.niveis) {
                    dispatch({ type: "SET_TOPIC_LEVELS", value: function(p) {
                      var n = Object.assign({}, p);
                      var count = 0;
                      Object.keys(d.niveis).forEach(function(t) {
                        if (validTopics.includes(t)) {
                          // Salva no bucket da atividade
                          if (!n[t] || typeof n[t].nivel === "number" || typeof n[t] === "number") n[t] = {};
                          n[t][importActivity] = { nivel: d.niveis[t].nivel || 0, pontos: d.niveis[t].pontos || 0 };
                          count++;
                        } else {
                          ignored.push(t);
                        }
                      });
                      return n;
                    }});
                    var nivelCount = Object.keys(d.niveis).filter(function(t) { return validTopics.includes(t); }).length;
                    if (nivelCount > 0) {
                      // Monta resumo de mudancas
                      var nivelDetails = Object.keys(d.niveis).filter(function(t) { return validTopics.includes(t); }).map(function(t) {
                        return t + ": " + DIFF_LABELS[d.niveis[t].nivel || 0] + " (" + (d.niveis[t].pontos || 0) + "pts)";
                      }).join(", ");
                      changes.push(nivelCount + " niveis atualizados em " + (ACTIVITY_LABELS[importActivity] || importActivity) + " (" + nivelDetails + ")");
                    }
                  }

                  if (d.erros) {
                    dispatch({ type: "SET_ERROR_BANK", value: function(p) {
                      var n = Object.assign({}, p);
                      Object.keys(d.erros).forEach(function(t) {
                        if (validTopics.includes(t)) { n[t] = d.erros[t]; }
                        else if (!ignored.includes(t)) { ignored.push(t); }
                      });
                      return n;
                    }});
                    var erroCount = Object.keys(d.erros).filter(function(t) { return validTopics.includes(t); }).length;
                    if (erroCount > 0) changes.push(erroCount + " erros atualizados");
                  }

                  if (d.flashcards && d.flashcards.length) {
                    var added = addFlashcards(d.flashcards);
                    setFcCards(getCardsForReview());
                    setFcTotal(loadFlashcards().length);
                    changes.push(added + " flashcards adicionados para revisao");
                  }

                  var msg = "Importado com sucesso!\n" + changes.join("\n");
                  if (ignored.length) msg += "\n\nTemas ignorados (nao reconhecidos): " + ignored.join(", ");
                  if (d.observacoes) msg += "\n\n" + d.observacoes;
                  setClaudeMsg(msg);
                  setClaudeImport("");
                } catch(e) {
                  setClaudeMsg("Erro: " + e.message);
                }
              }} style={{ marginTop: 8, padding: "10px 20px", borderRadius: 12, border: "none", background: "#E040FB", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Importar</button>
              {claudeMsg && claudeMsg !== "Copiado!" && <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 12, background: claudeMsg.startsWith("Erro") ? "rgba(255,77,109,0.08)" : "rgba(6,214,160,0.08)", border: "1px solid " + (claudeMsg.startsWith("Erro") ? "rgba(255,77,109,0.15)" : "rgba(6,214,160,0.15)"), fontSize: 12, color: claudeMsg.startsWith("Erro") ? "#FF4D6D" : "#06D6A0", lineHeight: 1.6 }}>{claudeMsg}</div>}
            </div>
          </div>;
        })()}

        {/* ─── GUIDE TAB ─── */}
        {!lessonModule && view === "guide" && <div style={{ animation: "fadeIn 0.2s ease" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Como Estudar</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {Object.keys(GUIDES).map(function(k) {
              var g = GUIDES[k];
              return <div key={k} onClick={function() { setGuideKey(k); }} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.04)", padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{g.t.split(" ")[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F5", marginBottom: 2 }}>{g.t.replace(/^\S+\s/, "")}</div>
                  <div style={{ fontSize: 12, color: "#444" }}>{g.d}</div>
                </div>
                <span style={{ color: "#333", fontSize: 16 }}>→</span>
              </div>;
            })}
          </div>
        </div>}

        {/* ─── MATERIAL TAB ─── */}
        {!lessonModule && view === "material" && <div style={{ animation: "fadeIn 0.2s ease" }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Meu Material</h2>
            <p style={{ fontSize: 13, color: "#444", margin: 0 }}>Envie resumos, anotações ou textos e gere questões e flashcards com IA</p>
          </div>

          {/* Upload area */}
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)", padding: "20px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F2F5", marginBottom: 12 }}>Adicionar material</div>
            <input
              value={matTitle}
              onChange={function(e){ setMatTitle(e.target.value); }}
              placeholder="Título (ex: Resumo IAM, Anotações Sepse...)"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0F2F5", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            />
            <textarea
              value={matContent}
              onChange={function(e){ setMatContent(e.target.value); }}
              placeholder="Cole seu texto aqui... (resumo, anotações, transcrição de aula, etc.)"
              style={{ width: "100%", minHeight: 120, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0F2F5", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label
                onDragOver={function(e){ e.preventDefault(); setDragOver(true); }}
                onDragLeave={function(){ setDragOver(false); }}
                onDrop={function(e){ e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
                style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: "1px dashed " + (dragOver ? "#4CC9F0" : "rgba(255,255,255,0.1)"), background: dragOver ? "rgba(76,201,240,0.06)" : "transparent", color: "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
              >
                📄 Clique ou arraste um arquivo .txt
                <input type="file" accept=".txt,.md" style={{ display: "none" }} onChange={function(e){ handleFileUpload(e.target.files[0]); }} />
              </label>
              <button
                onClick={addMaterial}
                disabled={!matTitle.trim() || !matContent.trim()}
                style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: matTitle.trim() && matContent.trim() ? "#4CC9F0" : "rgba(255,255,255,0.05)", color: matTitle.trim() && matContent.trim() ? "#0F1117" : "#444", fontWeight: 700, cursor: matTitle.trim() && matContent.trim() ? "pointer" : "not-allowed", fontSize: 13, whiteSpace: "nowrap" }}
              >+ Salvar</button>
            </div>
          </div>

          {/* Material list */}
          {materials.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: "#333", fontSize: 13 }}>Nenhum material salvo ainda</div>}
          <div style={{ display: "grid", gap: 10 }}>
            {materials.map(function(m) {
              return <div key={m.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(247,127,0,0.12)", padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F5", marginBottom: 3 }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: "#444" }}>{m.date} · {m.content.length} caracteres</div>
                  </div>
                  <button onClick={function(){ deleteMaterial(m.id); }} style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.15)", color: "#FF4D6D", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 10 }}>✕</button>
                </div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 14, lineHeight: 1.6, maxHeight: 48, overflow: "hidden" }}>{m.content.slice(0, 140)}...</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={function(){ setMatPractice({ material: m, mode: "questions" }); }} style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "none", background: "rgba(247,127,0,0.12)", color: "#F77F00", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📝 Gerar Questões</button>
                  <button onClick={function(){ setMatPractice({ material: m, mode: "flash" }); }} style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "none", background: "rgba(76,201,240,0.1)", color: "#4CC9F0", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🃏 Flashcards</button>
                </div>
              </div>;
            })}
          </div>
        </div>}

        {/* ─── MODULES TAB ─── */}
        {!lessonModule && view === "modules" && <div style={{ animation: "fadeIn 0.2s ease" }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Módulos</h2>
            <p style={{ fontSize: 13, color: "#444", margin: 0 }}>{TOTAL_WEEKS} semanas · {TOTAL_LESSONS} aulas</p>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {(function() {
              var weekAcc = 0;
              return MODULES.map(function(m) {
                var startW = weekAcc + 1;
                weekAcc += m.weeks;
                var endW = weekAcc;
                var done = getWatched(m.id).length;
                var total = m.lessons.length;
                var pct = Math.round((done / total) * 100);
                return <div key={m.id} onClick={function() { setLessonModule(m); }} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid " + m.color + "18", borderRadius: 16, padding: "16px 18px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: m.color + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{m.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#F0F2F5", lineHeight: 1.3 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>Sem {startW}–{endW} · {total} aulas</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: (pct === 100 ? "#06D6A0" : m.color) + "18", color: pct === 100 ? "#06D6A0" : m.color, whiteSpace: "nowrap", flexShrink: 0, marginLeft: 10 }}>{pct === 100 ? "✓ Completo" : pct + "%"}</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: pct === 100 ? "#06D6A0" : m.color, borderRadius: 2 }} />
                  </div>
                </div>;
              });
            })()}
          </div>
        </div>}

        {/* ─── ROADMAP TAB ─── */}
        {!lessonModule && view === "roadmap" && (function() {
          var ESSENTIALS = [
            { section: "MATA EM MINUTOS", color: "#FF4D6D", bg: "rgba(255,77,109,0.08)", lessons: [
              { modId: 1, lesson: "PCR com e sem ritmo chocável", why: "Se não souber isso, o paciente morre ali" },
              { modId: 1, lesson: "PCR na rua – Suporte Básico de Vida", why: "Você pode ser o único médico disponível" },
              { modId: 1, lesson: "Taquiarritmias", why: "Taqui instável = cardioversão imediata" },
              { modId: 1, lesson: "Bradiarritmias", why: "Bradi sintomática = atropina/marca-passo" },
              { modId: 4, lesson: "IOT Pt1", why: "Via aérea é sempre a prioridade #1" },
              { modId: 4, lesson: "IOT Pt2", why: "Técnica e drogas de sequência rápida" },
              { modId: 5, lesson: "Politrauma X e A", why: "ABCDE salva vidas — X e A são os primeiros" },
              { modId: 5, lesson: "Politrauma BCDE", why: "Completar a avaliação primária" },
              { modId: 5, lesson: "Choques Pt1", why: "Reconhecer o tipo de choque muda a conduta" },
              { modId: 5, lesson: "Choques Pt2", why: "Tratamento direcionado por tipo" },
              { modId: 6, lesson: "Anafilaxia Pt1", why: "Adrenalina IM sem hesitar" },
            ]},
            { section: "MATA EM HORAS", color: "#FF6B35", bg: "rgba(255,107,53,0.08)", lessons: [
              { modId: 2, lesson: "IAM Supra ST Pt1", why: "Tempo é miocárdio — reconhecer o supra" },
              { modId: 2, lesson: "IAM Supra ST Pt2", why: "Conduta inicial e decisão de trombólise" },
              { modId: 2, lesson: "SCA Pt1", why: "Nem todo IAM tem supra" },
              { modId: 2, lesson: "TEP Pt1", why: "Diagnóstico difícil, alta mortalidade" },
              { modId: 2, lesson: "EAP Pt1", why: "Edema agudo de pulmão é emergência" },
              { modId: 2, lesson: "Dissecção Aorta Pt1", why: "Dor torácica que rasga — não pode errar" },
              { modId: 3, lesson: "Sepse Pt1", why: "Hora 1 — antibiótico e volume" },
              { modId: 3, lesson: "Sepse Pt2", why: "Reconhecimento precoce pelo qSOFA" },
              { modId: 3, lesson: "Sepse Pt3", why: "Vasopressor e critérios de transferência" },
              { modId: 7, lesson: "AVC Pt1", why: "Janela de 4.5h para trombólise" },
              { modId: 7, lesson: "AVC Pt2", why: "NIHSS e decisão de transferência" },
              { modId: 8, lesson: "Hipercalemia", why: "Mata silenciosamente pelo coração" },
              { modId: 8, lesson: "CAD/EHH Pt1", why: "Cetoacidose é rotina na UPA" },
              { modId: 8, lesson: "CAD/EHH Pt2", why: "Protocolo de insulina e reposição" },
            ]},
            { section: "FREQUENTE NA UPA", color: "#FFD60A", bg: "rgba(255,214,10,0.08)", lessons: [
              { modId: 4, lesson: "Asma Pt1", why: "Uma das queixas mais comuns na UPA" },
              { modId: 4, lesson: "DPOC Pt1", why: "Exacerbação — NBZ + corticoide + O2" },
              { modId: 4, lesson: "Gasometria Pt1", why: "Interpretar gasometria é básico" },
              { modId: 3, lesson: "Dengue Pt1", why: "Epidemia recorrente no Brasil" },
              { modId: 3, lesson: "Dengue Pt2", why: "Classificação de risco e hidratação" },
              { modId: 3, lesson: "PAC Pt1", why: "Pneumonia é rotina — CURB-65" },
              { modId: 3, lesson: "ITU Pt1", why: "Infecção urinária todo plantão" },
              { modId: 3, lesson: "GECA Pt1", why: "Desidratação e critérios de internação" },
              { modId: 6, lesson: "Dor Abdominal Tipos", why: "Queixa #1 na UPA" },
              { modId: 6, lesson: "Dor Abdominal Alarme", why: "Sinais de abdome cirúrgico" },
              { modId: 6, lesson: "Intox. Exógenas Pt1", why: "Tentativas de suicídio são frequentes" },
              { modId: 7, lesson: "Crises Convulsivas Tipos", why: "Convulsão na UPA — conduta imediata" },
              { modId: 7, lesson: "Crises Convulsivas Tratamento", why: "Diazepam → Fenitoína → IOT" },
              { modId: 6, lesson: "Emerg. Psiq. Agitação", why: "Contenção e medicação — segurança da equipe" },
              { modId: 8, lesson: "Hipoglicemia Pt1", why: "Glicemia capilar em todo rebaixamento" },
              { modId: 2, lesson: "HAS Crises Pt1", why: "Emergência vs urgência hipertensiva" },
            ]},
          ];
          var allEssentials = [];
          ESSENTIALS.forEach(function(s) { s.lessons.forEach(function(l) { allEssentials.push(l); }); });
          var doneCount = allEssentials.filter(function(l) {
            var mod = MODULES.find(function(m) { return m.id === l.modId; });
            if (!mod) return false;
            var idx = mod.lessons.indexOf(l.lesson);
            return idx >= 0 && (ws[mod.id] || []).includes(idx);
          }).length;
          var totalCount = allEssentials.length;
          var totalPctE = Math.round((doneCount / totalCount) * 100);

          return <div style={{ animation: "fadeIn 0.2s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#F0F2F5", marginBottom: 6 }}>Essenciais da UPA</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>As aulas que você precisa dominar primeiro — selecionadas por gravidade e frequência</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 20 }}>
                <div style={{ width: 200, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ width: totalPctE + "%", height: "100%", borderRadius: 3, background: totalPctE === 100 ? "#06D6A0" : "#4CC9F0", transition: "width 0.5s" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: totalPctE === 100 ? "#06D6A0" : "#4CC9F0" }}>{doneCount}/{totalCount} ({totalPctE}%)</span>
              </div>
            </div>

            {ESSENTIALS.map(function(section) {
              return <div key={section.section} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: section.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, padding: "6px 12px", background: section.bg, borderRadius: 8, display: "inline-block" }}>{section.section}</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {section.lessons.map(function(l, i) {
                    var mod = MODULES.find(function(m) { return m.id === l.modId; });
                    if (!mod) return null;
                    var idx = mod.lessons.indexOf(l.lesson);
                    var isDone = idx >= 0 && (ws[mod.id] || []).includes(idx);
                    return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: isDone ? "rgba(6,214,160,0.04)" : "rgba(255,255,255,0.015)", border: "1px solid " + (isDone ? "rgba(6,214,160,0.15)" : "rgba(255,255,255,0.04)"), opacity: isDone ? 0.6 : 1 }}>
                      <div onClick={function() { if (idx >= 0) dispatch({ type: "TOGGLE_LESSON", moduleId: mod.id, lessonIdx: idx }); }} style={{ width: 22, height: 22, borderRadius: 6, cursor: "pointer", border: "2px solid " + (isDone ? "#06D6A0" : section.color + "50"), background: isDone ? "#06D6A0" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#0A0C10", flexShrink: 0, fontWeight: 700 }}>{isDone ? "✓" : ""}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? "#555" : "#F0F2F5", textDecoration: isDone ? "line-through" : "none" }}>
                          {mod.icon} {l.lesson.replace(/\s*Pt\d+/g, "")}
                        </div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{l.why}</div>
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: mod.color + "15", color: mod.color, flexShrink: 0 }}>{mod.name.split(" ").slice(0, 2).join(" ")}</div>
                    </div>;
                  })}
                </div>
              </div>;
            })}

            <div style={{ marginTop: 10, padding: "16px 20px", borderRadius: 14, background: "rgba(76,201,240,0.06)", border: "1px solid rgba(76,201,240,0.15)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4CC9F0", marginBottom: 8 }}>Como usar esta trilha</div>
              <div style={{ fontSize: 11, color: "#666", lineHeight: 1.8 }}>
                Comece pelo topo: <span style={{ color: "#FF4D6D", fontWeight: 600 }}>mata em minutos</span> primeiro (PCR, IOT, politrauma). Depois <span style={{ color: "#FF6B35", fontWeight: 600 }}>mata em horas</span> (IAM, sepse, AVC). Por fim, o <span style={{ color: "#FFD60A", fontWeight: 600 }}>frequente na UPA</span> (asma, dengue, dor abdominal). Marque cada aula conforme assistir — o progresso sincroniza com os módulos.
              </div>
            </div>
          </div>;
        })()}

        {/* ─── WEEK TAB ─── */}
        {!lessonModule && view === "week" && <div style={{ animation: "fadeIn 0.2s ease" }}>
          {/* Week nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={function() { dispatch({ type: "SET_WEEK", value: Math.max(1, cw - 1) }); }} disabled={cw === 1} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: cw === 1 ? "#2a2a2a" : "#D0D8E8", cursor: cw === 1 ? "not-allowed" : "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Semana {cw}</div>
            </div>
            <button onClick={function() { dispatch({ type: "SET_WEEK", value: Math.min(TOTAL_WEEKS, cw + 1) }); }} disabled={cw === TOTAL_WEEKS} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: cw === TOTAL_WEEKS ? "#2a2a2a" : "#D0D8E8", cursor: cw === TOTAL_WEEKS ? "not-allowed" : "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          </div>

          {/* Week progress */}
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 14, padding: "14px 16px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#444", fontWeight: 600, marginBottom: 8 }}>
              <span>Progresso da semana</span>
              <span style={{ color: sched.module.color }}>{Math.round(weekProg * 100)}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: Math.round(weekProg * 100) + "%", background: sched.module.color, borderRadius: 3, transition: "width 0.4s ease" }} />
            </div>
          </div>

          {/* Day selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
            {sched.days.map(function(d, i) {
              var isSel = selectedDay === i;
              var dayComplete = d.blocks.every(function(_, bi) { return ct["w" + cw + "-d" + i + "-b" + bi]; });
              return <button key={d.day} onClick={function() { setSelectedDay(isSel ? null : i); }} style={{ flex: "0 0 auto", padding: "8px 16px", borderRadius: 10, border: "1.5px solid " + (isSel ? sched.module.color : "rgba(255,255,255,0.05)"), background: isSel ? sched.module.color + "12" : "rgba(255,255,255,0.02)", color: isSel ? "#F0F2F5" : "#555", cursor: "pointer", fontWeight: 700, fontSize: 13, position: "relative" }}>
                {d.day}
                {dayComplete && <span style={{ position: "absolute", top: -2, right: -2, background: "#06D6A0", borderRadius: "50%", width: 12, height: 12, fontSize: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0C10", fontWeight: 700, border: "2px solid #0A0C10" }}>✓</span>}
              </button>;
            })}
          </div>

          {/* Day blocks */}
          <div style={{ display: "grid", gap: 12 }}>
            {sched.days.filter(function(_, i) { return selectedDay === null || selectedDay === i; }).map(function(d, di) {
              var realDi = selectedDay !== null ? selectedDay : di;
              return <div key={d.day} style={{ background: "rgba(255,255,255,0.015)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: sched.module.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: sched.module.color, fontWeight: 800 }}>{d.day.slice(0, 1)}</div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#D0D8E8" }}>{d.day}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#333", fontWeight: 600 }}>{d.hours}</span>
                </div>
                <div style={{ padding: "10px 12px", display: "grid", gap: 6 }}>
                  {d.blocks.map(function(b, bi) {
                    var taskKey = "w" + cw + "-d" + realDi + "-b" + bi;
                    var isDone = !!ct[taskKey];
                    var bt = BLOCK_TYPES[b.type];
                    var isPractice = b.type === "practice";
                    var pmode = b.label.includes("Simulado") ? "simulation" : b.label.includes("Simulação") ? "cases" : "questions";
                    return <div key={bi} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: isDone ? "rgba(6,214,160,0.04)" : bt.bg, borderLeft: "2.5px solid " + (isDone ? "#06D6A0" : bt.color), opacity: isDone ? 0.55 : 1, transition: "all 0.2s" }}>
                      <div onClick={function() { dispatch({ type: "TOGGLE_TASK", key: taskKey }); }} style={{ width: 22, height: 22, borderRadius: 6, cursor: "pointer", border: "2px solid " + (isDone ? "#06D6A0" : bt.color + "50"), background: isDone ? "#06D6A0" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#0A0C10", flexShrink: 0, fontWeight: 700 }}>{isDone ? "✓" : ""}</div>
                      <div style={{ flex: 1, cursor: "pointer" }} onClick={function() { dispatch({ type: "TOGGLE_TASK", key: taskKey }); }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? "#444" : "#D0D8E8", textDecoration: isDone ? "line-through" : "none" }}>{bt.icon} {b.label}</div>
                      </div>
                      <button onClick={function(e) { e.stopPropagation(); setTimerBlock({ dur: b.dur, label: b.label, color: bt.color }); }} title="Timer Pomodoro" style={{ width: 24, height: 24, borderRadius: 7, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "#888", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>⏱</button>
                      <button onClick={function(e) { e.stopPropagation(); setGuideKey(b.gk); }} style={{ width: 24, height: 24, borderRadius: 7, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "#444", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>?</button>
                      <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bt.color + "18", color: bt.color, flexShrink: 0 }}>{b.dur}</div>
                    </div>;
                  })}
                </div>
              </div>;
            })}
          </div>

          {/* Legend */}
          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {Object.keys(BLOCK_TYPES).map(function(k) {
              var bt = BLOCK_TYPES[k];
              return <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#333", fontWeight: 600 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: bt.color }} />
                {bt.icon} {bt.label}
              </div>;
            })}
          </div>
        </div>}

      </div>
    </div>
  );
}
