import { useState, useEffect, useReducer, useCallback } from "react";
import { LESSON_RESUMOS } from "./lessonResumos.js";

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
    topics: ["Sist. Cardiocirculatório","IC Aguda","Arritmias","FA","Bradiarritmias","IAM/SCA","BRE","EAP","HAS Crises","TEP","TVP","OAA","Dissecção Aorta","Emerg. HAS Gestacional"]
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
const DIFF_COLORS = ["#4CC9F0", "#06D6A0", "#F77F00", "#FFD60A", "#E040FB", "#ff0040"];
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
  welcome: {
    t: "🚀 Primeiros Passos",
    d: "Bem-vindo ao Pronto Atendimento Suckel! Este app foi feito para você estudar medicina de emergência de forma inteligente. Aqui está o fluxo completo de como usar.",
    tips: [
      "1. Vá na aba Módulos e escolha o módulo que quer estudar",
      "2. Assista as aulas do curso e marque cada tema como concluído clicando no checkbox",
      "3. Clique no nome do tema para expandir o resumo completo da aula — use para revisar",
      "4. Vá na aba Atividades e escolha uma atividade (Questões, Caso Clínico, etc.)",
      "5. O app gera um prompt personalizado com seus temas e nível. Copie e cole em uma IA",
      "6. Pratique com a IA. Ao terminar, digite 'finalizei' e ele gera um relatório",
      "7. Cole o relatório de volta no app para atualizar seu progresso automaticamente",
      "8. Revise seus flashcards diariamente na aba Flashcards"
    ]
  },
  modules: {
    t: "📋 Módulos e Resumos",
    d: "A aba Módulos é onde você acompanha seu progresso nas aulas. Cada módulo tem vários temas, e cada tema tem um resumo completo que você pode consultar a qualquer momento.",
    tips: [
      "Marque os temas conforme for assistindo as aulas do curso — clique no checkbox à esquerda",
      "Clique no nome do tema para expandir o resumo. O resumo contém todas as informações da aula: definições, protocolos, doses, classificações",
      "Os temas marcados são usados para gerar as atividades. Quanto mais temas marcar, mais variadas serão suas questões",
      "Você pode desmarcar um tema a qualquer momento se quiser refazer",
      "A barra de progresso mostra quantos temas você já concluiu em cada módulo"
    ]
  },
  activities: {
    t: "🩺 Atividades com IA",
    d: "A aba Atividades é o coração do app. Aqui você gera prompts personalizados para praticar com uma IA. O prompt já vem com seus temas, nível de dificuldade e resumos das aulas.",
    tips: [
      "Escolha uma atividade: Questões (múltipla escolha adaptativa), Caso Clínico (raciocínio diagnóstico) ou Investigação Clínica (interrogar e examinar)",
      "Clique na seta para gerar o prompt. Depois clique em 'Copiar' para copiar o texto",
      "Abra uma IA (como Claude, ChatGPT, etc.) e cole o prompt. A IA vai começar a atividade imediatamente",
      "Quando terminar a sessão, digite 'finalizei' para a IA. Ele vai gerar um bloco de código com seus resultados",
      "Volte ao app, cole o relatório na caixa 'Importar relatório' e clique em Importar. Seus níveis, erros e flashcards serão atualizados automaticamente",
      "O sistema adapta a dificuldade por tema: acertos sobem o nível, erros voltam para reforço"
    ]
  },
  flashcards: {
    t: "🃏 Flashcards",
    d: "Os flashcards usam o algoritmo SM-2 (mesmo do Anki). Cada card tem um fator de facilidade que se adapta às suas respostas. Cards que você domina aparecem cada vez menos; cards difíceis voltam com frequência.",
    tips: [
      "Revise todos os dias — poucos minutos de revisão consistente vencem horas de estudo espaçado",
      "Tente lembrar ANTES de virar o card. Sem esforço de recuperação, não há memorização",
      "De novo — Não lembrei nada. O card volta imediatamente pra fila de aprendizado",
      "Difícil — Lembrei com muito esforço. O intervalo cresce devagar (×1.2) e a facilidade diminui",
      "Bom — Lembrei após pensar um pouco. O intervalo cresce normalmente (× facilidade)",
      "Fácil — Lembrei instantaneamente. O intervalo cresce rápido (× facilidade × 1.3) e a facilidade aumenta",
      "Cards novos passam por etapas de aprendizado (1min → 10min) antes de graduar com intervalo de 1 dia",
      "Se errar um card já graduado, ele volta pras etapas de aprendizado e o intervalo é reduzido pela metade",
      "Os flashcards são gerados automaticamente dos seus erros ao importar o relatório da IA na aba Atividades"
    ]
  },
  levels: {
    t: "📊 Estatísticas",
    d: "A aba Estatísticas mostra seus acertos e erros por tema. Use para identificar pontos fracos e direcionar seus estudos.",
    tips: [
      "Cada tema mostra: total de acertos, total de erros e percentual de acerto",
      "Verde (≥70%) = tema dominado. Amarelo (≥50%) = precisa reforço. Vermelho (<50%) = ponto fraco",
      "Os dados são atualizados a cada relatório importado na aba Atividades",
      "Use as estatísticas para decidir quais temas revisar: foque nos vermelhos e amarelos",
      "O badge de nível ao lado de cada tema mostra seu nível atual naquele assunto",
      "Você pode limpar as estatísticas a qualquer momento para recomeçar do zero"
    ]
  },
  schedule: {
    t: "📅 Semana e Trilha",
    d: "A aba Semana organiza seu estudo por dia com blocos de teoria, prática e revisão. A aba Trilha mostra os temas essenciais priorizados por gravidade — do que mata em minutos ao que é frequente na UPA.",
    tips: [
      "Na aba Semana, siga o cronograma sugerido. Marque cada bloco conforme for completando",
      "A Trilha mostra a ordem ideal de estudo: primeiro o que mata rápido (PCR, IOT), depois o que mata em horas (IAM, sepse), por fim o frequente (asma, dengue)",
      "Não precisa seguir a ordem rigidamente — mas priorize os temas vermelhos (mata em minutos) se está começando",
      "Use o mapa mental ou resumo após cada bloco de aula para consolidar"
    ]
  },
  tips: {
    t: "🧠 Dicas de Estudo",
    d: "Técnicas comprovadas para maximizar seu aprendizado em medicina de emergência.",
    tips: [
      "Assista as aulas na velocidade 1x ou 1.25x — velocidades maiores prejudicam a compreensão em conteúdos técnicos",
      "Após cada aula, feche o caderno e explique o conteúdo em voz alta como se fosse para um paciente leigo (Técnica Feynman)",
      "Faça pelo menos uma sessão de questões após cada aula, ainda que curta (10-15 min). O impacto na retenção é enorme",
      "Varie entre Questões, Caso Clínico e Investigação — cada formato treina um aspecto diferente do raciocínio médico",
      "Monte mapas mentais: centro = tema, ramos = fisiopatologia, clínica, exames, tratamento e complicações",
      "Antes de provas ou plantões, revise os mapas mentais e flashcards — muito mais eficiente do que reler textos"
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

// Mapeamento explícito: lesson → topic
var LESSON_TOPIC_MAP = {
  // Módulo 1
  "PCR com e sem ritmo chocável": "PCR", "Dúvidas sobre PCR": "PCR",
  "PCR na rua – Suporte Básico de Vida": "Suporte Básico de Vida", "Dúvidas sobre PCR na rua": "Suporte Básico de Vida",
  "Cuidados pós PCR": "Cuidados pós-PCR", "Caso clínico pós PCR": "Cuidados pós-PCR",
  "Taquiarritmias": "Taquiarritmias", "Caso clínico Taquiarritmias": "Taquiarritmias",
  "Bradiarritmias": "Bradiarritmias",
  // Módulo 2
  "Sist. Cardiocirculatório Pt1": "Sist. Cardiocirculatório", "Sist. Cardiocirculatório Pt2": "Sist. Cardiocirculatório", "Sist. Cardiocirculatório Pt3": "Sist. Cardiocirculatório",
  "IC Aguda Pt1": "IC Aguda", "IC Aguda Pt2": "IC Aguda", "IC Aguda Pt3": "IC Aguda",
  "Taquiarritmias Pt1": "Arritmias", "Taquiarritmias Pt2": "Arritmias", "Taquiarritmias Pt3": "Arritmias",
  "FA (2025) Pt1": "FA", "FA Pt2": "FA", "FA Pt3": "FA",
  "Bradiarritmias Pt1": "Bradiarritmias", "Bradiarritmias Pt2": "Bradiarritmias", "Bradiarritmias Pt3": "Bradiarritmias",
  "IAM Supra ST Pt1": "IAM/SCA", "IAM Supra ST Pt2": "IAM/SCA", "IAM Supra ST Pt3": "IAM/SCA",
  "SCA Pt1": "IAM/SCA", "SCA Pt2": "IAM/SCA", "SCA Pt3": "IAM/SCA", "Infarto VD": "IAM/SCA",
  "BRE Pt1": "BRE", "BRE Pt2": "BRE", "BRE Pt3": "BRE",
  "EAP Pt1": "EAP", "EAP Pt2": "EAP", "EAP Pt3": "EAP",
  "HAS Crises Pt1": "HAS Crises", "HAS Crises Pt2": "HAS Crises", "HAS Crises Pt3": "HAS Crises",
  "TEP Pt1": "TEP", "TEP Pt2": "TEP", "TEP Pt3": "TEP",
  "TVP Fisiopato": "TVP", "TVP Tratamento": "TVP", "TVP Caso": "TVP", "TVP Dúvidas": "TVP",
  "OAA Pt1": "OAA", "OAA Pt2": "OAA", "OAA Pt3": "OAA",
  "Dissecção Aorta Pt1": "Dissecção Aorta", "Dissecção Aorta Pt2": "Dissecção Aorta", "Dissecção Aorta Pt3": "Dissecção Aorta", "Dissecção Caso": "Dissecção Aorta",
  "Emerg HAS Gestacional Pt1": "Emerg. HAS Gestacional", "Emerg HAS Gestacional Pt2": "Emerg. HAS Gestacional", "Emerg HAS Gestacional Pt3": "Emerg. HAS Gestacional",
  // Módulo 3
  "IVAS Gripes Pt1": "IVAS", "IVAS Gripes Pt2": "IVAS", "IVAS Gripes Pt3": "IVAS", "IVAS Faringite/Otite": "IVAS",
  "IVAS RSA Pt1": "IVAS", "IVAS RSA Pt2": "IVAS", "IVAS RSA Pt3": "IVAS",
  "IVAS Faringite Pt1": "IVAS", "IVAS Faringite Pt2": "IVAS", "IVAS Faringite Pt3": "IVAS", "Retirada inseto": "IVAS",
  "PAC Pt1": "PAC", "PAC Pt2": "PAC", "PAC Pt3": "PAC",
  "Inf. Cutâneas Visão geral": "Inf. Cutâneas", "Impetigo": "Inf. Cutâneas", "Foliculite": "Inf. Cutâneas", "Furúnculo": "Inf. Cutâneas",
  "Erisipela x Celulite": "Inf. Cutâneas", "Fasciíte Necrosante": "Inf. Cutâneas", "Inf. Cutâneas Caso": "Inf. Cutâneas",
  "ITU Pt1": "ITU", "ITU Pt2": "ITU", "ITU Pt3": "ITU", "Sondagem Vesical": "ITU",
  "GECA Pt1": "GECA", "GECA Pt2": "GECA", "GECA Pt3": "GECA",
  "Sepse Pt1": "Sepse", "Sepse Pt2": "Sepse", "Sepse Pt3": "Sepse",
  "Dengue Pt1": "Dengue/Chik/Zika", "Dengue Pt2": "Dengue/Chik/Zika", "Dengue Pt3": "Dengue/Chik/Zika", "Chikungunya": "Dengue/Chik/Zika", "Zika": "Dengue/Chik/Zika",
  "Meningites Pt1": "Meningites", "Meningites Pt2": "Meningites", "Meningites Pt3": "Meningites",
  "DIP Pt1": "DIP", "DIP Pt2": "DIP", "DIP Pt3": "DIP", "Resumo Infecções": "DIP",
  "Síndrome Febril Pt1": "Síndrome Febril", "Síndrome Febril Pt2": "Síndrome Febril", "Síndrome Febril Pt3": "Síndrome Febril",
  "Leptospirose Pt1": "Leptospirose", "Leptospirose Pt2": "Leptospirose",
  // Módulo 4
  "IOT Pt1": "IOT", "IOT Pt2": "IOT", "IOT Dúvidas": "IOT",
  "Gasometria Pt1": "Gasometria", "Gasometria Pt2": "Gasometria", "Gasometria Pt3": "Gasometria",
  "DPOC Pt1": "DPOC", "DPOC Pt2": "DPOC", "DPOC Pt3": "DPOC",
  "Asma Pt1": "Asma", "Asma Pt2": "Asma", "Asma Pt3": "Asma",
  "Insuf. Resp. Pt1": "Insuf. Resp.", "Insuf. Resp. Pt2": "Insuf. Resp.", "Insuf. Resp. Casos": "Insuf. Resp.",
  "VM Pt1": "VM", "VM Pt2": "VM", "VM Simulador": "VM",
  "Desmame VM Sedação": "Desmame VM", "Desmame VM TRE": "Desmame VM", "Desmame VM Dúvidas": "Desmame VM", "Desmame VM Simulador": "Desmame VM",
  // Módulo 5
  "Politrauma X e A": "Politrauma", "Politrauma BCDE": "Politrauma", "Politrauma Caso": "Politrauma",
  "Trauma Torácico Pt1": "Trauma Torácico", "Trauma Torácico Pt2": "Trauma Torácico", "Trauma Torácico Casos": "Trauma Torácico", "Trauma Torácico Dúvidas": "Trauma Torácico",
  "Trauma Abd/Pélvico Pt1": "Trauma Abd/Pélvico", "Trauma Abd/Pélvico Pt2": "Trauma Abd/Pélvico", "Trauma Abd/Pélvico Casos": "Trauma Abd/Pélvico", "Trauma Abd/Pélvico Dúvidas": "Trauma Abd/Pélvico",
  "Choques Pt1": "Choques", "Choques Pt2": "Choques", "Choques Pt3": "Choques",
  "TCE Pt1": "TCE", "TCE Pt2": "TCE", "TCE Caso": "TCE", "TCE Dúvidas": "TCE",
  "TRM Entendendo": "TRM", "TRM Choque neurogênico": "TRM", "TRM Caso": "TRM", "TRM Dúvidas": "TRM",
  "Afogamento Fisiopato": "Afogamento", "Afogamento Graus": "Afogamento", "Afogamento Caso": "Afogamento", "Afogamento Dúvidas": "Afogamento",
  "Queimaduras Tipos": "Queimaduras", "Queimaduras Condutas": "Queimaduras", "Queimaduras Caso": "Queimaduras",
  // Módulo 6
  "Dor Abdominal Tipos": "Dor Abdominal", "Dor Abdominal Alarme": "Dor Abdominal", "Dor Abdominal Raciocínio": "Dor Abdominal",
  "Dor Abdominal Casos": "Dor Abdominal", "Dor Abdominal Casos2": "Dor Abdominal", "Dor Abdominal Dúvidas": "Dor Abdominal",
  "Cólica Nefrítica Pt1": "Cólica Nefrítica", "Cólica Nefrítica Pt2": "Cólica Nefrítica", "Cólica Nefrítica Pt3": "Cólica Nefrítica",
  "Anafilaxia Pt1": "Anafilaxia", "Anafilaxia Pt2": "Anafilaxia", "Anafilaxia Pt3": "Anafilaxia",
  "Intox. Exógenas Pt1": "Intox. Exógenas", "Intox. Exógenas Pt2": "Intox. Exógenas", "Intox. Exógenas Pt3": "Intox. Exógenas",
  "Animais Peçonh. Pt1": "Animais Peçonh.", "Animais Peçonh. Pt2": "Animais Peçonh.", "Animais Peçonh. Casos": "Animais Peçonh.", "Animais Peçonh. Dúvidas": "Animais Peçonh.",
  "Lombalgias Passo a passo": "Lombalgias", "Lombalgias Medicações": "Lombalgias", "Lombalgias Dúvidas": "Lombalgias",
  "Vertigens Fisiologia": "Vertigens", "Vertigens Tratamento": "Vertigens", "Vertigens Casos": "Vertigens", "Vertigens Dúvidas": "Vertigens",
  "Emerg. Psiq. Suicídio": "Emerg. Psiq.", "Emerg. Psiq. Agitação": "Emerg. Psiq.", "Emerg. Psiq. Caso": "Emerg. Psiq.", "Emerg. Psiq. Dúvidas": "Emerg. Psiq.",
  "Pancreatite Pt1": "Pancreatite", "Pancreatite Pt2": "Pancreatite", "Pancreatite Pt3": "Pancreatite", "Complicações Pancreatite": "Pancreatite",
  "Artrite Gotosa": "Gota", "Gota Fisiopato Pt1": "Gota", "Gota Caso": "Gota", "Gota Diagnóstico Pt2": "Gota", "Gota Dúvidas": "Gota", "Gota Prescrição Pt3": "Gota",
  "HDA x HDB": "HDA/HDB", "Hemorragias Tratamentos": "HDA/HDB", "Hemorragias Dúvidas": "HDA/HDB",
  "Abd. Obstrutivo Fisiopato": "Abd. Obstrutivo", "Abd. Obstrutivo Raciocínio": "Abd. Obstrutivo", "Abd. Obstrutivo Caso": "Abd. Obstrutivo", "Abd. Obstrutivo Dúvidas": "Abd. Obstrutivo",
  "Abd. Inflamatório Pt1": "Abd. Inflamatório", "Abd. Inflamatório Pt2": "Abd. Inflamatório", "Abd. Inflamatório Pt3": "Abd. Inflamatório", "Intox. Metanol": "Abd. Inflamatório",
  // Módulo 7
  "AVC Pt1": "AVC", "AVC Pt2": "AVC", "AVC Pt3": "AVC",
  "AIT": "AIT", "AIT Caso": "AIT",
  "Crises Convulsivas Tipos": "Crises Convulsivas", "Crises Convulsivas Tratamento": "Crises Convulsivas", "Crises Convulsivas Casos": "Crises Convulsivas", "Crises Convulsivas Dúvidas": "Crises Convulsivas",
  "Cefaleias Pt1": "Cefaleias", "Cefaleias Pt2": "Cefaleias", "Cefaleias Casos": "Cefaleias", "Cefaleias Dúvidas": "Cefaleias",
  "Vertigens Fisiologia": "Vertigens", "Vertigens Tratamentos": "Vertigens", "Vertigens Casos": "Vertigens", "Vertigens Dúvidas": "Vertigens",
  "Rebaixamento Consciência Pt1": "Rebaixamento Consciência", "Rebaixamento Consciência Pt2": "Rebaixamento Consciência", "Rebaixamento Consciência Pt3": "Rebaixamento Consciência",
  "Síncope Pt1": "Síncope", "Síncope Pt2": "Síncope", "Síncope Pt3": "Síncope",
  // Módulo 8
  "Hiponatremia Pt1": "Hiponatremia", "Hiponatremia Pt2": "Hiponatremia", "Hiponatremia Pt3": "Hiponatremia",
  "Hipernatremia Pt1": "Hipernatremia", "Hipernatremia Pt2": "Hipernatremia",
  "Hipercalemia": "Hipercalemia", "Hipercalemia Casos": "Hipercalemia",
  "Hipocalemia e Mg/Ca": "Hipocalemia", "Hipocalemia Casos": "Hipocalemia",
  "CAD/EHH Pt1": "CAD/EHH", "CAD/EHH Pt2": "CAD/EHH", "CAD/EHH Pt3": "CAD/EHH",
  "Hipoglicemia Pt1": "Hipoglicemia", "Hipoglicemia Pt2": "Hipoglicemia",
  "LRA Conceito": "LRA", "LRA Diagnóstico": "LRA", "LRA Casos": "LRA", "LRA Dúvidas": "LRA"
};

function getUniqueTopicFromLesson(name) {
  if (LESSON_TOPIC_MAP[name]) return LESSON_TOPIC_MAP[name];
  // Fallback: strip sufixos
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
  // Usa mapeamento explícito primeiro
  var mapped = LESSON_TOPIC_MAP[lesson];
  if (mapped) return mapped === topic;
  // Fallback
  var nLesson = normalize(lesson);
  var nTopic = normalize(topic);
  var nClean = normalize(getUniqueTopicFromLesson(lesson));
  return nClean === nTopic || nLesson.indexOf(nTopic) >= 0;
}

function getResumoForLesson(lessonName) {
  if (LESSON_RESUMOS[lessonName]) return LESSON_RESUMOS[lessonName];
  var topic = getUniqueTopicFromLesson(lessonName);
  if (LESSON_RESUMOS[topic]) return LESSON_RESUMOS[topic];
  var normalizedName = normalize(topic);
  for (var key in LESSON_RESUMOS) {
    var normalizedKey = normalize(key);
    if (normalizedName === normalizedKey) return LESSON_RESUMOS[key];
    if (normalizedName.indexOf(normalizedKey) >= 0 || normalizedKey.indexOf(normalizedName) >= 0) return LESSON_RESUMOS[key];
  }
  return null;
}

function makeSchedule(weekNum) {
  var mod = getModuleForWeek(weekNum);
  return {
    module: mod,
    days: [
      { day: "Seg", hours: "4h", blocks: [
        { label: "Aula", dur: "2h", type: "theory", gk: "modules" },
        { label: "Flashcards", dur: "1h", type: "review", gk: "flashcards" },
        { label: "Questões", dur: "1h", type: "practice", gk: "activities" },
      ]},
      { day: "Ter", hours: "4h", blocks: [
        { label: "Aula", dur: "2.5h", type: "theory", gk: "modules" },
        { label: "Caso Clínico", dur: "1.5h", type: "practice", gk: "activities" },
      ]},
      { day: "Qua", hours: "4h", blocks: [
        { label: "Aula", dur: "2h", type: "theory", gk: "modules" },
        { label: "Flashcards", dur: "1h", type: "review", gk: "flashcards" },
        { label: "Questões", dur: "1h", type: "practice", gk: "activities" },
      ]},
      { day: "Qui", hours: "4h", blocks: [
        { label: "Aula", dur: "2h", type: "theory", gk: "modules" },
        { label: "Mapa Mental / Resumo", dur: "1h", type: "review", gk: "tips" },
        { label: "Investigação Clínica", dur: "1h", type: "practice", gk: "activities" },
      ]},
      { day: "Sex", hours: "4h", blocks: [
        { label: "Revisão da Semana", dur: "1.5h", type: "review", gk: "flashcards" },
        { label: "Questões + Casos", dur: "2.5h", type: "practice", gk: "activities" },
      ]},
    ]
  };
}

// ════════════════════════════════════════
// STORAGE (localStorage)
// ════════════════════════════════════════
var STORAGE_KEY = "medico-pratica";
var NAME_KEY = "medico-pratica-name";
var FLASHCARDS_KEY = "medico-pratica-flashcards";
var STATS_KEY = "medico-pratica-stats";

function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || "[]"); } catch(e) { return []; }
}
function saveSession(session) {
  var stats = loadStats();
  stats.push(session);
  // Mantém últimas 100 sessões
  if (stats.length > 100) stats = stats.slice(stats.length - 100);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch(e) {}
}

// ═══ ANKI SM-2 ALGORITHM ═══
// Configurações (mesmos defaults do Anki)
var ANKI = {
  learningSteps: [1, 10],       // minutos (step 0 = 1min, step 1 = 10min)
  graduatingInterval: 1,        // dias ao graduar
  easyInterval: 4,              // dias ao clicar Fácil em card novo
  startingEase: 2.5,            // ease factor inicial (250%)
  easyBonus: 1.3,               // multiplicador extra pro Fácil
  intervalModifier: 1.0,        // multiplicador global
  maxInterval: 365,             // máximo em dias
  lapseNewInterval: 0.5,        // ao errar: novo intervalo = antigo * 0.5
  lapseMinInterval: 1,          // mínimo 1 dia ao reaprender
  relearningSteps: [10]         // minutos ao reaprender após lapse
};
// Estados: "new", "learning", "review", "relearning"

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
      ivl: 0,                    // intervalo atual em dias
      ease: ANKI.startingEase,
      queue: "new",              // new, learning, review, relearning
      step: 0,                   // step atual dentro de learningSteps/relearningSteps
      reviews: 0,
      lapses: 0,
      streak: 0,
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

function migrateCard(card) {
  if (card.queue === undefined) {
    card.queue = card.reviews > 2 ? "review" : "new";
    card.step = 0;
    card.ease = card.ease || ANKI.startingEase;
    card.ivl = card.intervalDays || 0;
    card.lapses = card.lapses || 0;
    card.streak = card.streak || 0;
  }
  return card;
}

function setNextReview(card, minutes) {
  var next = new Date();
  if (minutes < 1440) {
    // Menos de 1 dia: agenda em minutos (mas como usamos datas, agenda pra hoje)
    card.nextReview = next.toISOString().slice(0, 10);
  } else {
    var days = Math.round(minutes / 1440);
    next.setDate(next.getDate() + days);
    card.nextReview = next.toISOString().slice(0, 10);
  }
}

// quality: 0=De novo, 1=Difícil, 2=Bom, 3=Fácil
function reviewCard(cardId, quality) {
  var cards = loadFlashcards();
  var idx = cards.findIndex(function(c) { return c.id === cardId; });
  if (idx < 0) return;
  var card = migrateCard(Object.assign({}, cards[idx]));
  card.reviews++;

  if (card.queue === "new" || card.queue === "learning") {
    // ── CARD NOVO / APRENDENDO ──
    var steps = ANKI.learningSteps;
    if (quality === 0) {
      // De novo: volta ao step 0
      card.step = 0;
      card.queue = "learning";
      setNextReview(card, steps[0]);
    } else if (quality === 1) {
      // Difícil: repete step atual (ou avança se step > 0)
      card.queue = "learning";
      setNextReview(card, steps[card.step] || steps[steps.length - 1]);
    } else if (quality === 2) {
      // Bom: avança step
      card.step++;
      if (card.step >= steps.length) {
        // Gradua!
        card.queue = "review";
        card.ivl = ANKI.graduatingInterval;
        card.step = 0;
        setNextReview(card, ANKI.graduatingInterval * 1440);
      } else {
        card.queue = "learning";
        setNextReview(card, steps[card.step]);
      }
    } else {
      // Fácil: gradua imediatamente com easy interval
      card.queue = "review";
      card.ivl = ANKI.easyInterval;
      card.step = 0;
      card.ease = Math.min(3.0, card.ease + 0.15);
      card.streak++;
      setNextReview(card, ANKI.easyInterval * 1440);
    }
  } else if (card.queue === "relearning") {
    // ── REAPRENDENDO (após lapse) ──
    var rsteps = ANKI.relearningSteps;
    if (quality === 0) {
      card.step = 0;
      setNextReview(card, rsteps[0]);
    } else if (quality === 1) {
      setNextReview(card, rsteps[card.step] || rsteps[rsteps.length - 1]);
    } else if (quality === 2) {
      card.step++;
      if (card.step >= rsteps.length) {
        // Volta pra review com intervalo reduzido
        card.queue = "review";
        card.ivl = Math.max(ANKI.lapseMinInterval, Math.round(card.ivl * ANKI.lapseNewInterval));
        card.step = 0;
        setNextReview(card, card.ivl * 1440);
      } else {
        setNextReview(card, rsteps[card.step]);
      }
    } else {
      // Fácil: sai de relearning direto
      card.queue = "review";
      card.ivl = Math.max(ANKI.lapseMinInterval + 1, Math.round(card.ivl * ANKI.lapseNewInterval));
      card.step = 0;
      card.streak++;
      setNextReview(card, card.ivl * 1440);
    }
  } else {
    // ── CARD EM REVISÃO ──
    if (quality === 0) {
      // Lapse! Vai pra relearning
      card.lapses++;
      card.streak = 0;
      card.ease = Math.max(1.3, card.ease - 0.2);
      card.queue = "relearning";
      card.step = 0;
      setNextReview(card, ANKI.relearningSteps[0]);
    } else if (quality === 1) {
      // Difícil: intervalo * 1.2, ease - 0.15
      card.streak++;
      card.ease = Math.max(1.3, card.ease - 0.15);
      card.ivl = Math.min(ANKI.maxInterval, Math.max(card.ivl + 1, Math.round(card.ivl * 1.2 * ANKI.intervalModifier)));
      setNextReview(card, card.ivl * 1440);
    } else if (quality === 2) {
      // Bom: intervalo * ease
      card.streak++;
      card.ivl = Math.min(ANKI.maxInterval, Math.max(card.ivl + 1, Math.round(card.ivl * card.ease * ANKI.intervalModifier)));
      setNextReview(card, card.ivl * 1440);
    } else {
      // Fácil: intervalo * ease * easyBonus, ease + 0.15
      card.streak++;
      card.ease = Math.min(3.0, card.ease + 0.15);
      card.ivl = Math.min(ANKI.maxInterval, Math.max(card.ivl + 1, Math.round(card.ivl * card.ease * ANKI.easyBonus * ANKI.intervalModifier)));
      setNextReview(card, card.ivl * 1440);
    }
  }

  cards[idx] = card;
  saveFlashcards(cards);
  return card.ivl;
}

function formatInterval(minutes) {
  if (minutes < 60) return minutes + "min";
  if (minutes < 1440) return Math.round(minutes / 60) + "h";
  var days = Math.round(minutes / 1440);
  if (days === 1) return "1d";
  if (days < 30) return days + "d";
  if (days < 365) return Math.round(days / 30) + "m";
  return Math.round(days / 365) + "a";
}

function getNextIntervalPreview(card, quality) {
  if (!card) return "";
  var c = migrateCard(Object.assign({}, card));

  if (c.queue === "new" || c.queue === "learning") {
    var steps = ANKI.learningSteps;
    if (quality === 0) return formatInterval(steps[0]);
    if (quality === 1) return formatInterval(steps[c.step] || steps[steps.length - 1]);
    if (quality === 2) {
      var ns = c.step + 1;
      if (ns >= steps.length) return ANKI.graduatingInterval + "d";
      return formatInterval(steps[ns]);
    }
    return ANKI.easyInterval + "d";
  }
  if (c.queue === "relearning") {
    var rs = ANKI.relearningSteps;
    if (quality === 0) return formatInterval(rs[0]);
    if (quality === 1) return formatInterval(rs[c.step] || rs[rs.length - 1]);
    if (quality === 2) {
      if (c.step + 1 >= rs.length) return Math.max(ANKI.lapseMinInterval, Math.round(c.ivl * ANKI.lapseNewInterval)) + "d";
      return formatInterval(rs[c.step + 1]);
    }
    return Math.max(ANKI.lapseMinInterval + 1, Math.round(c.ivl * ANKI.lapseNewInterval)) + "d";
  }
  // Review
  if (quality === 0) return formatInterval(ANKI.relearningSteps[0]);
  if (quality === 1) return Math.min(ANKI.maxInterval, Math.max(c.ivl + 1, Math.round(c.ivl * 1.2))) + "d";
  if (quality === 2) return Math.min(ANKI.maxInterval, Math.max(c.ivl + 1, Math.round(c.ivl * c.ease))) + "d";
  return Math.min(ANKI.maxInterval, Math.max(c.ivl + 1, Math.round(c.ivl * Math.min(3.0, c.ease + 0.15) * ANKI.easyBonus))) + "d";
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
// HELPER: RESUMOS DAS AULAS ASSISTIDAS
// ════════════════════════════════════════
function buildWatchedResumos(watchedState, relevantTopics) {
  var resumos = [];
  var seen = {};
  MODULES.forEach(function(m) {
    var watched = watchedState[m.id] || [];
    watched.forEach(function(i) {
      var lesson = m.lessons[i];
      if (!lesson) return;
      var topic = getUniqueTopicFromLesson(lesson);
      if (seen[topic]) return;
      if (relevantTopics && relevantTopics.length > 0) {
        var isRelevant = relevantTopics.some(function(rt) {
          return normalize(topic).indexOf(normalize(rt)) >= 0 || normalize(rt).indexOf(normalize(topic)) >= 0;
        });
        if (!isRelevant) return;
      }
      var resumo = getResumoForLesson(lesson);
      if (resumo) {
        seen[topic] = true;
        resumos.push(resumo);
      }
    });
  });
  return resumos;
}

function buildResumoPromptBlock(watchedState, relevantTopics) {
  var resumos = buildWatchedResumos(watchedState, relevantTopics);
  if (!resumos.length) return "";
  var joined = resumos.slice(0, 5).join("\n---\n").slice(0, 8000);
  return "\n\nRESUMOS DAS AULAS JÁ ESTUDADAS PELO ALUNO (use como base para criar questões fiéis ao conteúdo):\n" + joined + "\n";
}

// ════════════════════════════════════════
// FLASHCARDS COMPONENT
// ════════════════════════════════════════
function Flashcards({ errorBank, watchedState, onClose }) {
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
    if (!topics.length) { setError("Assista algumas aulas primeiro."); setLoading(false); return; }
    var errTopics = Object.keys(errorBank).filter(function(t) { return errorBank[t] > 0; }).sort(function(a,b) { return (errorBank[b]||0) - (errorBank[a]||0); });
    var allTopics = errTopics.concat(topics).slice(0, 5).join(", ") || "emergências médicas";
    var resumoRef = buildResumoPromptBlock(watchedState, allTopics.split(", "));
    var prompt = 'Crie 6 flashcards de medicina sobre: ' + allTopics + '.' + resumoRef + '\nAPENAS JSON: {"flashcards":[{"frente":"pergunta","verso":"resposta"}]}';
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

          <div style={{ minHeight: 200, borderRadius: 18, border: "1px solid " + (flipped ? col + "40" : "rgba(255,255,255,0.07)"), background: flipped ? col + "08" : "rgba(255,255,255,0.02)", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transition: "all 0.3s ease", position: "relative" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#444", marginBottom: 12 }}>PERGUNTA</div>
            <div style={{ fontSize: 15, color: "#F0F2F5", lineHeight: 1.8, fontWeight: 600 }}>{card.frente}</div>
            {flipped && (
              <div style={{ width: "100%", marginTop: 20 }}>
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: col, marginBottom: 12 }}>RESPOSTA</div>
                <div style={{ fontSize: 13, color: "#8B99B0", lineHeight: 1.8, fontWeight: 400 }}>{card.verso}</div>
              </div>
            )}
          </div>

          {!flipped && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button onClick={function() { setFlipped(true); }} style={{ padding: "10px 28px", borderRadius: 12, border: "1px solid " + col + "40", background: col + "10", color: col, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>🔄 Virar card</button>
            </div>
          )}
          {flipped && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={function() { if (index < cards.length - 1) { setIndex(index + 1); setFlipped(false); } else { setDone(true); } }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "rgba(6,214,160,0.12)", color: "#06D6A0", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>✅ Sabia</button>
              <button onClick={function() { if (index < cards.length - 1) { setIndex(index + 1); setFlipped(false); } else { setDone(true); } }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "rgba(255,77,109,0.12)", color: "#FF4D6D", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>❌ Não sabia</button>
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

function TabTips({ guideKey }) {
  var g = GUIDES[guideKey];
  if (!g) return null;
  return <div style={{ marginTop: 28, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 10, letterSpacing: "0.03em" }}>💡 DICAS</div>
    <div style={{ display: "grid", gap: 6 }}>
      {g.tips.map(function(tip, i) {
        return <div key={i} style={{ fontSize: 12, color: "#666", lineHeight: 1.7, paddingLeft: 12, borderLeft: "2px solid rgba(255,255,255,0.05)" }}>{tip}</div>;
      })}
    </div>
  </div>;
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
  var [lessonModule, setLessonModule] = useState(null);
  var [expandedTopic, setExpandedTopic] = useState(null);
  var [showFlashcards, setShowFlashcards] = useState(false);
  var [timerBlock, setTimerBlock] = useState(null); // { dur, label, color }
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
  var totalBlocks = sched.days.reduce(function(s, d) { return s + d.blocks.length; }, 0);
  var doneBlocks = Object.keys(ct).filter(function(k) { return k.startsWith("w" + cw + "-"); }).length;
  var weekProg = doneBlocks / totalBlocks;

  var navItems = [
    { key: "week",     label: "Semana",   icon: "📅" },
    { key: "modules",  label: "Módulos",  icon: "📋" },
    { key: "claude",   label: "Atividades", icon: "🩺" },
    { key: "errors",   label: "Estatísticas", icon: "📊" },
    { key: "flashcards", label: "Flashcards", icon: "🃏" },
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
      {showFlashcards && <Flashcards errorBank={errorBank} watchedState={ws} onClose={function() { setShowFlashcards(false); }} />}


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


      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "0 24px", background: "rgba(10,12,16,0.9)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/icon.svg" alt="icon" style={{ width: 44, height: 44, borderRadius: 12 }} />
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
              var indices = [];
              lessonModule.lessons.forEach(function(l, i) {
                if (lessonMatchesTopic(l, topic)) indices.push(i);
              });
              var allDone = indices.length > 0 && indices.every(function(i) { return getWatched(lessonModule.id).includes(i); });
              var someDone = indices.some(function(i) { return getWatched(lessonModule.id).includes(i); });
              var resumo = getResumoForLesson(topic) || (indices.length > 0 ? getResumoForLesson(lessonModule.lessons[indices[0]]) : null);
              var isExpanded = expandedTopic === topic;
              return <div key={topic}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: isExpanded ? "10px 10px 0 0" : 10, background: "rgba(255,255,255,0.015)", borderLeft: "2px solid " + (allDone ? "#06D6A0" : someDone ? lessonModule.color : "rgba(255,255,255,0.05)"), opacity: allDone ? 0.5 : 1, transition: "all 0.2s" }}>
                  <div onClick={function(e) {
                    e.stopPropagation();
                    indices.forEach(function(i) {
                      var isWatched = getWatched(lessonModule.id).includes(i);
                      if (allDone) {
                        if (isWatched) dispatch({ type: "TOGGLE_LESSON", modId: lessonModule.id, idx: i });
                      } else {
                        if (!isWatched) dispatch({ type: "TOGGLE_LESSON", modId: lessonModule.id, idx: i });
                      }
                    });
                  }} style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid " + (allDone ? "#06D6A0" : someDone ? lessonModule.color : "rgba(255,255,255,0.1)"), background: allDone ? "#06D6A0" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#0A0C10", flexShrink: 0, fontWeight: 700, cursor: "pointer" }}>{allDone ? "✓" : ""}</div>
                  <div onClick={function() { if (resumo) setExpandedTopic(isExpanded ? null : topic); }} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, cursor: resumo ? "pointer" : "default" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: allDone ? "#444" : "#D0D8E8", textDecoration: allDone ? "line-through" : "none" }}>{topic}</span>
                    {resumo && <span style={{ fontSize: 10, color: isExpanded ? lessonModule.color : "#333", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>}
                  </div>
                  <span style={{ fontSize: 10, color: "#444" }}>{indices.filter(function(i) { return getWatched(lessonModule.id).includes(i); }).length}/{indices.length}</span>
                </div>
                {isExpanded && resumo && <div style={{ padding: "16px 18px", background: "rgba(255,255,255,0.02)", borderLeft: "2px solid " + lessonModule.color + "40", borderRadius: "0 0 10px 10px", marginBottom: 2 }}>
                  <div style={{ fontSize: 12, color: "#8B99B0", lineHeight: 1.9, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{resumo}</div>
                </div>}
              </div>;
            })}
          </div>
        </div>}

        {/* ─── ESTATÍSTICAS TAB ─── */}
        {!lessonModule && view === "errors" && (function() {
          var stats = loadStats();

          // Agrupa acertos e erros por tema (todas as sessões)
          var topicStats = {};
          stats.forEach(function(sess) {
            (sess.temas || []).forEach(function(t) {
              if (!topicStats[t]) topicStats[t] = { acertos: 0, erros: 0 };
              topicStats[t].acertos += (sess.temaAcertos && sess.temaAcertos[t]) || 0;
              topicStats[t].erros += (sess.temaErros && sess.temaErros[t]) || 0;
            });
          });

          // Ordena: mais questões respondidas primeiro
          var topicList = Object.keys(topicStats).sort(function(a, b) {
            var totalA = topicStats[a].acertos + topicStats[a].erros;
            var totalB = topicStats[b].acertos + topicStats[b].erros;
            return totalB - totalA;
          });

          var grandAcertos = topicList.reduce(function(s, t) { return s + topicStats[t].acertos; }, 0);
          var grandErros = topicList.reduce(function(s, t) { return s + topicStats[t].erros; }, 0);
          var grandTotal = grandAcertos + grandErros;
          var grandPct = grandTotal > 0 ? Math.round((grandAcertos / grandTotal) * 100) : 0;

          return <div style={{ animation: "fadeIn 0.2s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Estatísticas</h2>
              <p style={{ fontSize: 13, color: "#444", margin: 0 }}>Acertos e erros por tema</p>
            </div>

            {/* Resumo geral */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(6,214,160,0.06)", border: "1px solid rgba(6,214,160,0.12)" }}>
                <div style={{ fontSize: 10, color: "#06D6A0", fontWeight: 700, marginBottom: 4 }}>ACERTOS</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#06D6A0" }}>{grandAcertos}</div>
              </div>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.12)" }}>
                <div style={{ fontSize: 10, color: "#FF4D6D", fontWeight: 700, marginBottom: 4 }}>ERROS</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#FF4D6D" }}>{grandErros}</div>
              </div>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(76,201,240,0.06)", border: "1px solid rgba(76,201,240,0.12)" }}>
                <div style={{ fontSize: 10, color: "#4CC9F0", fontWeight: 700, marginBottom: 4 }}>% ACERTO</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: grandPct >= 70 ? "#06D6A0" : grandPct >= 50 ? "#FFD60A" : "#FF4D6D" }}>{grandPct}%</div>
              </div>
            </div>

            {/* Por tema */}
            {topicList.length > 0 && <div style={{ display: "grid", gap: 8 }}>
              {topicList.map(function(topic) {
                var s = topicStats[topic];
                var total = s.acertos + s.erros;
                var pct = total > 0 ? Math.round((s.acertos / total) * 100) : 0;
                var color = pct >= 70 ? "#06D6A0" : pct >= 50 ? "#FFD60A" : "#FF4D6D";
                return <div key={topic} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#F0F2F5" }}>{topic}</span>
                      <DiffBadge topic={topic} topicLevels={topicLevels} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: color }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
                    <div style={{ height: "100%", borderRadius: 3, background: color, width: pct + "%", transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#06D6A0" }}>✓ {s.acertos} acertos</span>
                    <span style={{ color: "#FF4D6D" }}>✗ {s.erros} erros</span>
                    <span style={{ color: "#555" }}>{total} questões</span>
                  </div>
                </div>;
              })}
            </div>}

            {/* Sem dados */}
            {topicList.length === 0 && <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", marginBottom: 6 }}>Nenhum dado ainda</div>
              <div style={{ fontSize: 13, color: "#444" }}>Importe seu primeiro relatório na aba Atividades para ver suas estatísticas.</div>
            </div>}

            {/* Limpar */}
            {topicList.length > 0 && <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button onClick={function() { try { localStorage.setItem(STATS_KEY, "[]"); } catch(e) {} dispatch({ type: "SET_ERROR_BANK", value: {} }); setView("errors"); }} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#444", fontWeight: 600, cursor: "pointer", fontSize: 11 }}>Limpar estatísticas</button>
            </div>}

            <TabTips guideKey="levels" />
          </div>;
        })()}

        {/* ─── FLASHCARDS TAB ─── */}
        {!lessonModule && view === "flashcards" && (function() {
          var allCards = loadFlashcards();
          var dueCards = fcCards;
          var card = dueCards[fcIndex];
          var nextReviewCards = allCards.filter(function(c) { return c.nextReview > new Date().toISOString().slice(0, 10); });

          function handleReview(quality) {
            if (!card) return;
            reviewCard(card.id, quality);
            setFcFlipped(false);
            var updated = getCardsForReview();
            setFcCards(updated);
            if (fcIndex >= updated.length) setFcIndex(0);
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
              <div style={{ fontSize: 13, color: "#444" }}>Pratique na aba Atividades e importe o relatório — os flashcards dos seus erros aparecerão aqui automaticamente.</div>
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
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 20, padding: "32px 24px", border: "1px solid rgba(255,255,255,0.06)", minHeight: 160, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", transition: "all 0.2s" }}>
                <div style={{ fontSize: 11, color: "#555", fontWeight: 700, marginBottom: 12, letterSpacing: "0.05em" }}>PERGUNTA</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#F0F2F5", lineHeight: 1.7 }}>{card.frente}</div>
                {fcFlipped && <div style={{ width: "100%", marginTop: 20 }}>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
                  <div style={{ fontSize: 11, color: "#06D6A0", fontWeight: 700, marginBottom: 12, letterSpacing: "0.05em" }}>RESPOSTA</div>
                  <div style={{ fontSize: 15, color: "#8B99B0", lineHeight: 1.7 }}>{card.verso}</div>
                </div>}
              </div>
              {!fcFlipped && <div style={{ marginTop: 16, textAlign: "center" }}>
                <button onClick={function(e) { e.stopPropagation(); setFcFlipped(true); }} style={{ padding: "12px 32px", borderRadius: 14, border: "1px solid rgba(76,201,240,0.3)", background: "rgba(76,201,240,0.08)", color: "#4CC9F0", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>🔄 Virar card</button>
              </div>}
              {fcFlipped && <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#444", textAlign: "center", marginBottom: 8 }}>Quão bem você lembrou?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                  <button onClick={function() { handleReview(0); }} style={{ padding: "12px 4px", borderRadius: 12, border: "1px solid rgba(255,77,109,0.25)", background: "rgba(255,77,109,0.08)", color: "#FF4D6D", fontWeight: 700, cursor: "pointer", fontSize: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 11, marginBottom: 4 }}>{getNextIntervalPreview(card, 0)}</div>
                    <div>De novo</div>
                  </button>
                  <button onClick={function() { handleReview(1); }} style={{ padding: "12px 4px", borderRadius: 12, border: "1px solid rgba(247,127,0,0.25)", background: "rgba(247,127,0,0.08)", color: "#F77F00", fontWeight: 700, cursor: "pointer", fontSize: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 11, marginBottom: 4 }}>{getNextIntervalPreview(card, 1)}</div>
                    <div>Difícil</div>
                  </button>
                  <button onClick={function() { handleReview(2); }} style={{ padding: "12px 4px", borderRadius: 12, border: "1px solid rgba(76,201,240,0.25)", background: "rgba(76,201,240,0.08)", color: "#4CC9F0", fontWeight: 700, cursor: "pointer", fontSize: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 11, marginBottom: 4 }}>{getNextIntervalPreview(card, 2)}</div>
                    <div>Bom</div>
                  </button>
                  <button onClick={function() { handleReview(3); }} style={{ padding: "12px 4px", borderRadius: 12, border: "1px solid rgba(6,214,160,0.25)", background: "rgba(6,214,160,0.08)", color: "#06D6A0", fontWeight: 700, cursor: "pointer", fontSize: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 11, marginBottom: 4 }}>{getNextIntervalPreview(card, 3)}</div>
                    <div>Fácil</div>
                  </button>
                </div>
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 10, color: "#555", lineHeight: 1.6 }}>
                    <span style={{ color: "#FF4D6D" }}>De novo</span> — Não lembrei nada, quero ver de novo agora · <span style={{ color: "#F77F00" }}>Difícil</span> — Lembrei com muito esforço · <span style={{ color: "#4CC9F0" }}>Bom</span> — Lembrei após pensar um pouco · <span style={{ color: "#06D6A0" }}>Fácil</span> — Lembrei instantaneamente
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#333", marginTop: 6, textAlign: "center" }}>
                  {"Revisões: " + card.reviews + " · Facilidade: " + ((card.ease || 2.5) * 100).toFixed(0) + "%" + (card.streak ? " · Sequência: " + card.streak : "") + (card.lapses ? " · Lapsos: " + card.lapses : "")}
                </div>
              </div>}
            </div>}
            <TabTips guideKey="flashcards" />
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
            var resumosTxt = buildWatchedResumos(ws, watchedTopics).slice(0, 5).join("\n---\n").slice(0, 8000) || "nenhum";
            return { errTopics: errTopics, levels: levels, modProgress: modProgress, errTxt: errTxt, levelTxt: levelTxt, resumosTxt: resumosTxt, watchedTopics: watchedTopics, watchedTxt: watchedTxt };
          }

          var allTopicNames = [];
          MODULES.forEach(function(m) { (m.topics || []).forEach(function(t) { if (!allTopicNames.includes(t)) allTopicNames.push(t); }); });
          var syncFormat = '\n\n--- INSTRUCOES INTERNAS (nao mostrar ao aluno) ---\n' +
            'Mantenha um registro interno de acertos e erros por tema durante a conversa.\n' +
            'NAO gere o bloco de relatorio durante a conversa. Gere APENAS quando o aluno digitar "finalizei".\n\n' +
            '--- QUANDO O ALUNO DIGITAR "finalizei" ---\n' +
            'Gere o relatorio EXATAMENTE neste formato, dentro de um bloco de codigo com a tag medico-sync:\n\n' +
            '```medico-sync\n' +
            '{\n' +
            '  "acao": "atualizar",\n' +
            '  "dados": {\n' +
            '    "niveis": {\n' +
            '      "NomeTema": { "nivel": 0, "pontos": 0 }\n' +
            '    },\n' +
            '    "erros": {\n' +
            '      "NomeTema": 0\n' +
            '    },\n' +
            '    "flashcards": [\n' +
            '      { "frente": "pergunta", "verso": "resposta" }\n' +
            '    ],\n' +
            '    "observacoes": "resumo"\n' +
            '  }\n' +
            '}\n' +
            '```\n\n' +
            'EXEMPLO PREENCHIDO (supondo que o aluno acertou PCR e errou Sepse, partindo de PCR nivel 2 com 1pt e Sepse nivel 1 com 2pts):\n\n' +
            '```medico-sync\n' +
            '{\n' +
            '  "acao": "atualizar",\n' +
            '  "dados": {\n' +
            '    "niveis": {\n' +
            '      "PCR": { "nivel": 2, "pontos": 2 },\n' +
            '      "Sepse": { "nivel": 0, "pontos": 2 }\n' +
            '    },\n' +
            '    "erros": {\n' +
            '      "Sepse": 1\n' +
            '    },\n' +
            '    "flashcards": [\n' +
            '      { "frente": "Qual antibiotico iniciar na sepse de foco pulmonar?", "verso": "Ceftriaxona 2g IV + Azitromicina 500mg IV (ou Levofloxacino 750mg IV se alergia)" }\n' +
            '    ],\n' +
            '    "observacoes": "Bom desempenho em PCR. Revisar antibioticoterapia na sepse."\n' +
            '  }\n' +
            '}\n' +
            '```\n\n' +
            'REGRAS DO RELATORIO:\n' +
            '1. O JSON DEVE estar dentro do bloco ```medico-sync ... ```. OBRIGATORIO.\n' +
            '2. Use EXATAMENTE os nomes dos temas listados abaixo. Nomes diferentes nao serao reconhecidos.\n' +
            '3. Inclua APENAS temas que apareceram na sessao.\n' +
            '4. Gere 1 flashcard para cada tema que o aluno ERROU (foque no ponto exato do erro).\n' +
            '5. O campo "erros" conta apenas os erros DESTA sessao (nao acumula).\n\n' +
            'PROGRESSAO DE NIVEIS:\n' +
            '- Niveis: 0=Muito Facil, 1=Facil, 2=Moderado, 3=Dificil, 4=Muito Dificil, 5=Impossivel\n' +
            '- Pontos para subir de nivel: 0→2pts, 1→3pts, 2→3pts, 3→4pts, 4→5pts, 5→1pt\n' +
            '- ACERTO: +1 ponto. Se pontos atingem o necessario, sobe nivel e pontos voltam a 0.\n' +
            '- ERRO: volta nivel anterior COM pontos cheios (ex: se cai pro nivel 2 que precisa 3pts, fica com 3pts — so precisa 1 acerto pra subir de novo). No nivel 0 zera pontos.\n' +
            '- Parta dos niveis/pontos ATUAIS informados acima e aplique acertos/erros para chegar ao valor FINAL.\n\n' +
            'NOMES VALIDOS DOS TEMAS (use EXATAMENTE estes):\n' + allTopicNames.join(", ");

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
                "--- RESUMOS DAS AULAS ESTUDADAS ---",
                sd.resumosTxt,
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
                "8. Use os resumos das aulas estudadas como base quando o tema coincidir",
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
                "--- RESUMOS DAS AULAS ESTUDADAS ---",
                sd.resumosTxt,
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
                "--- RESUMOS DAS AULAS ESTUDADAS ---",
                sd.resumosTxt,
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
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Atividades com IA</h2>
              <p style={{ fontSize: 13, color: "#444", margin: 0 }}>Escolha uma atividade, copie o prompt e cole em uma IA</p>
            </div>

            {/* Tutorial */}
            <div style={{ marginBottom: 20, padding: "16px 18px", borderRadius: 14, background: "rgba(76,201,240,0.04)", border: "1px solid rgba(76,201,240,0.10)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4CC9F0", marginBottom: 10 }}>Como funciona</div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { n: "1", text: "Marque os temas já estudados na aba Módulos" },
                  { n: "2", text: "Escolha uma atividade abaixo e clique na seta →" },
                  { n: "3", text: "Clique em 'Copiar prompt' e cole em uma IA" },
                  { n: "4", text: "Pratique com a IA — ele faz questões no seu nível" },
                  { n: "5", text: "Ao terminar, digite 'finalizei' para a IA" },
                  { n: "6", text: "A IA vai gerar uma mensagem de código. Clique no botão Copiar que aparece abaixo da mensagem:", icon: true },
                  { n: "7", text: "Cole na caixa 'Importar relatório' abaixo e clique em Importar" },
                  { n: "8", text: "Após importar, vá para a aba Flashcards e revise os cards gerados dos seus erros" },
                ].map(function(step) {
                  return <div key={step.n}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(76,201,240,0.12)", color: "#4CC9F0", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{step.n}</div>
                      <span style={{ fontSize: 12, color: "#8B99B0", lineHeight: 1.5 }}>{step.text}</span>
                    </div>
                    {step.icon && <div style={{ marginTop: 8, marginLeft: 32, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B99B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      <span style={{ fontSize: 12, color: "#8B99B0", fontWeight: 600 }}>Copiar</span>
                    </div>}
                  </div>;
                })}
              </div>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: "#4CC9F0" }}>Prompt gerado — copie e cole em uma IA</div>
                <button onClick={function() { setClaudeExport(""); setClaudeActivity(null); setClaudeMsg(""); }} style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>← Voltar</button>
              </div>
              <textarea readOnly value={claudeExport} style={{ width: "100%", minHeight: 180, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#8B99B0", padding: 14, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical" }} onClick={function(e) { e.target.select(); }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={function() { navigator.clipboard.writeText(claudeExport); setClaudeMsg("Copiado!"); }} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#06D6A0", color: "#0F1117", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Copiar prompt</button>
                {claudeMsg === "Copiado!" && <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#06D6A0" }}>Copiado! Copiado! Cole em uma IA e comece.</span>}
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
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E040FB", marginBottom: 10 }}>Importar relatório</div>
              <p style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>Quando terminar, digite "finalizei" na IA. Cole a resposta inteira aqui — o app encontra o bloco automaticamente.</p>
              <textarea value={claudeImport} onChange={function(e) { setClaudeImport(e.target.value); setClaudeMsg(""); }} placeholder={"Cole aqui a resposta inteira da IA..."} style={{ width: "100%", minHeight: 100, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#D0D8E8", padding: 14, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical" }} />
              <button onClick={function() {
                try {
                  // Limpa aspas curvas, caracteres especiais e whitespace unicode
                  var raw = claudeImport
                    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
                    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
                    .replace(/\u00A0/g, " ");
                  // 1. Tenta bloco ```medico-sync ... ```
                  var syncMatch = raw.match(/```medico-sync\s*([\s\S]*?)```/) || raw.match(/```medico\s*([\s\S]*?)```/);
                  // 2. Tenta bloco ```json ... ``` que contenha "acao"
                  if (!syncMatch) {
                    var jsonBlock = raw.match(/```json\s*([\s\S]*?)```/);
                    if (jsonBlock && jsonBlock[1].indexOf('"acao"') >= 0) syncMatch = jsonBlock;
                  }
                  // 3. Tenta qualquer bloco ``` ... ``` que contenha "acao"
                  if (!syncMatch) {
                    var anyBlock = raw.match(/```\s*([\s\S]*?)```/);
                    if (anyBlock && anyBlock[1].indexOf('"acao"') >= 0) syncMatch = anyBlock;
                  }
                  // 4. Tenta JSON após palavra "medico" sem bloco de código
                  if (!syncMatch) {
                    var medicoMatch = raw.match(/medico[\s\-_]*sync?\s*\n?\s*(\{[\s\S]*\})/i);
                    if (medicoMatch) syncMatch = [null, medicoMatch[1]];
                  }
                  // 5. Tenta achar JSON solto com "acao":"atualizar"
                  if (!syncMatch) {
                    var jsonMatch = raw.match(/\{\s*"acao"\s*:\s*"atualizar"[\s\S]*\}/);
                    if (jsonMatch) syncMatch = [null, jsonMatch[0]];
                  }
                  // 6. Tenta achar JSON solto com "dados" e "niveis"
                  if (!syncMatch) {
                    var dataMatch = raw.match(/\{\s*"dados"\s*:\s*\{[\s\S]*"niveis"[\s\S]*\}/);
                    if (dataMatch) syncMatch = [null, dataMatch[0]];
                  }
                  // 7. Tenta achar qualquer JSON grande com "niveis"
                  if (!syncMatch) {
                    var niveisMatch = raw.match(/\{[\s\S]*"niveis"\s*:\s*\{[\s\S]*\}\s*\}/);
                    if (niveisMatch) syncMatch = [null, niveisMatch[0]];
                  }
                  if (!syncMatch) throw new Error("Relatório não encontrado. Certifique-se de digitar 'finalizei' na IA e copiar a resposta completa.");
                  var jsonStr = syncMatch[1].trim();
                  var data;
                  try { data = JSON.parse(jsonStr); } catch(parseErr) {
                    // Tenta limpar o JSON progressivamente
                    var cleaned = jsonStr;
                    // Remove aspas simples dentro de valores de string
                    cleaned = cleaned.replace(/"([^"]*)"/g, function(m) { return m.replace(/'/g, ""); });
                    try { data = JSON.parse(cleaned); } catch(e2) {
                      // Tenta extrair só a parte JSON válida
                      var braceCount = 0; var start = -1; var end = -1;
                      for (var ci = 0; ci < cleaned.length; ci++) {
                        if (cleaned[ci] === "{") { if (start < 0) start = ci; braceCount++; }
                        if (cleaned[ci] === "}") { braceCount--; if (braceCount === 0 && start >= 0) { end = ci + 1; break; } }
                      }
                      if (start >= 0 && end > start) {
                        try { data = JSON.parse(cleaned.slice(start, end)); } catch(e3) {
                          throw new Error("JSON invalido. Tente copiar a resposta da IA novamente.");
                        }
                      } else {
                        throw new Error("JSON invalido. Tente copiar a resposta da IA novamente.");
                      }
                    }
                  }
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

                  // Salva sessão nas estatísticas
                  var sessionData = {
                    date: new Date().toISOString(),
                    activity: importActivity,
                    temaErros: {},
                    temaAcertos: {},
                    temas: []
                  };
                  if (d.niveis) {
                    Object.keys(d.niveis).forEach(function(t) {
                      if (validTopics.includes(t)) {
                        sessionData.temas.push(t);
                        sessionData.temaAcertos[t] = (sessionData.temaAcertos[t] || 0);
                      }
                    });
                  }
                  if (d.erros) {
                    Object.keys(d.erros).forEach(function(t) {
                      if (validTopics.includes(t)) {
                        sessionData.temaErros[t] = d.erros[t];
                        if (!sessionData.temas.includes(t)) sessionData.temas.push(t);
                      }
                    });
                  }
                  // Estima acertos por tema: se apareceu e não errou, acertou
                  sessionData.temas.forEach(function(t) {
                    var erros = sessionData.temaErros[t] || 0;
                    sessionData.temaAcertos[t] = erros > 0 ? 0 : 1;
                  });
                  saveSession(sessionData);

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
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#F0F2F5", fontFamily: "'Newsreader', serif", fontStyle: "italic" }}>Tutorial</h2>
          <p style={{ fontSize: 13, color: "#444", margin: "0 0 20px" }}>Aprenda a usar o app e tire o máximo do seu estudo</p>
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

          {/* Exportar / Importar dados */}
          <div style={{ marginTop: 28, padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 12, letterSpacing: "0.05em" }}>SINCRONIZAR DADOS</div>
            <p style={{ fontSize: 12, color: "#444", marginBottom: 12 }}>Transfira seus dados entre o app local e o app online.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={function() {
                var data = {};
                [STORAGE_KEY, NAME_KEY, FLASHCARDS_KEY, FEEDBACK_KEY].forEach(function(k) {
                  try { var v = localStorage.getItem(k); if (v) data[k] = v; } catch(e) {}
                });
                var json = JSON.stringify(data);
                var blob = new Blob([json], { type: "application/json" });
                var url = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = url;
                a.download = "medico-pratica-backup.json";
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "rgba(76,201,240,0.12)", color: "#4CC9F0", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Exportar dados</button>
              <button onClick={function() {
                var input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = function(e) {
                  var file = e.target.files[0];
                  if (!file) return;
                  var reader = new FileReader();
                  reader.onload = function(ev) {
                    try {
                      var data = JSON.parse(ev.target.result);
                      Object.keys(data).forEach(function(k) {
                        localStorage.setItem(k, data[k]);
                      });
                      alert("Dados importados com sucesso! O app vai recarregar.");
                      window.location.reload();
                    } catch(err) {
                      alert("Erro ao importar: " + err.message);
                    }
                  };
                  reader.readAsText(file);
                };
                input.click();
              }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "rgba(224,64,251,0.12)", color: "#E040FB", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Importar dados</button>
            </div>
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
          <TabTips guideKey="modules" />
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
          <TabTips guideKey="schedule" />
        </div>}

      </div>
    </div>
  );
}
