/* ==========================================================================
   MUSITEST CORE CORE ENGINE - ENRUTAMIENTO, PARSER Y REALTIME SYSTEM
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, update, onValue, child 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Inicialización de Credenciales Estrictas
const firebaseConfig = {
  apiKey: "AIzaSyCNs2oPeVaRAx7q-97QCjKzIT--wVnHS3o",
  authDomain: "musitest-c1d2a.firebaseapp.com",
  projectId: "musitest-c1d2a",
  storageBucket: "musitest-c1d2a.firebasestorage.app",
  messagingSenderId: "631952906510",
  appId: "1:631952906510:web:0a027b9407360b52e21f5f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Variables de Estado de Aplicación Local (SPA)
let currentUser = null;
let currentRole = "student"; // 'student' | 'admin'
let authMode = "login";      // 'login' | 'register'
let activeExamListener = null;
let localExamQuestions = [];
let localExamState = {
    currentIndex: 0,
    answers: {},
    timerInterval: null,
    secondsLeft: 0
};

// Selectores del DOM Globales
const views = {
    auth: document.getElementById("view-auth"),
    studentDash: document.getElementById("view-student-dashboard"),
    examEnv: document.getElementById("view-exam-environment"),
    waitingRes: document.getElementById("view-waiting-results"),
    adminDash: document.getElementById("view-admin-dashboard")
};

/* ==========================================================================
   MOTOR DE ENRUTAMIENTO NATIVO DE VISTAS (SPA ENGINE)
   ========================================================================== */

function switchView(targetViewId) {
    Object.keys(views).forEach(key => {
        if (views[key].id === targetViewId) {
            views[key].classList.add("active");
        } else {
            views[key].classList.remove("active");
        }
    });
}

/* ==========================================================================
   ALGORITMO Fisher-Yates DE ALEATORIZACIÓN TOTAL DE PREGUNTAS Y OPCIONES
   ========================================================================== */

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ==========================================================================
   SISTEMA DE AUTENTICACIÓN SIMPLIFICADO BASADO EN REGISTROS EN REALTIME DB
   ========================================================================== */

function initAuthEvents() {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const registerFields = document.getElementById("register-fields");
    const authForm = document.getElementById("auth-form");
    const submitBtn = document.getElementById("auth-submit-btn");

    tabLogin.addEventListener("click", () => {
        authMode = "login";
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        registerFields.classList.remove("show");
        submitBtn.innerText = "Ingresar a la Plataforma";
    });

    tabRegister.addEventListener("click", () => {
        authMode = "register";
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        registerFields.classList.add("show");
        submitBtn.innerText = "Crear Cuenta Nueva";
    });

    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("auth-username").value.trim().toLowerCase();
        const password = document.getElementById("auth-password").value;

        if (!username || !password) return alert("Por favor complete todos los campos.");

        if (authMode === "register") {
            const fullname = document.getElementById("auth-fullname").value.trim();
            const level = document.getElementById("auth-level").value;
            if (!fullname) return alert("Ingrese su nombre completo para el registro.");

            // Validar existencia de usuario previa
            const snapshot = await get(ref(db, `students/${username}`));
            if (snapshot.exists()) {
                return alert("El nombre de usuario ya se encuentra registrado.");
            }

            const newStudent = {
                username, password, fullname, level, createdAt: Date.now()
            };
            await set(ref(db, `students/${username}`), newStudent);
            alert("Registro exitoso. Ya puedes iniciar sesión.");
            tabLogin.click();
        } else {
            // Lógica de Login Puro
            const snapshot = await get(ref(db, `students/${username}`));
            if (!snapshot.exists()) {
                return alert("El usuario ingresado no existe en el sistema.");
            }
            const userData = snapshot.val();
            if (userData.password !== password) {
                return alert("Contraseña incorrecta.");
            }

            currentUser = userData;
            currentRole = "student";
            setupStudentSession();
        }
    });

    document.getElementById("btn-logout").addEventListener("click", () => {
        currentUser = null;
        if (activeExamListener) activeExamListener(); // Desvincular listener en vivo
        clearInterval(localExamState.timerInterval);
        switchView("view-auth");
    });
}

/* ==========================================================================
   ÁREA ESTUDIANTE: SINCRONIZACIÓN LIVE Y RESTAURACIÓN ANTICAÍDAS
   ========================================================================== */

function setupStudentSession() {
    document.getElementById("student-display-name").innerText = currentUser.fullname;
    document.getElementById("student-display-level").innerText = currentUser.level;
    
    switchView("view-student-dashboard");
    loadStudentHistoryAndMetrics();
    listenToLiveExamChannels();
}

async function loadStudentHistoryAndMetrics() {
    const snapshot = await get(ref(db, `results`));
    const tbody = document.getElementById("student-history-tbody");
    tbody.innerHTML = "";
    
    if (!snapshot.exists()) {
        updateMiniMetrics(0, 0);
        return;
    }

    let totalScore = 0;
    let matchCount = 0;

    snapshot.forEach((testNode) => {
        const testId = testNode.key;
        const studentResult = testNode.child(currentUser.username).val();
        
        if (studentResult) {
            matchCount++;
            totalScore += studentResult.percentage;
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${studentResult.testTitle}</strong></td>
                <td>${new Date(studentResult.timestamp).toLocaleDateString()}</td>
                <td>${studentResult.score} / ${studentResult.totalQuestions}</td>
                <td><span class="badge" style="background-color: ${studentResult.percentage >= 61 ? '#d1fae5' : '#fee2e2'}; color: ${studentResult.percentage >= 61 ? '#065f46' : '#991b1b'}">${studentResult.percentage}%</span></td>
                <td><button class="btn btn-secondary btn-sm btn-print-pdf" data-testid="${testId}">📄 Descargar PDF</button></td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (matchCount === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aún no has participado en ninguna evaluación.</td></tr>`;
    }

    updateMiniMetrics(matchCount, matchCount > 0 ? Math.round(totalScore / matchCount) : 0);

    // Adjuntar eventos de descarga PDF nativos
    document.querySelectorAll(".btn-print-pdf").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tId = e.target.getAttribute("data-testid");
            generateNativePDFReport(tId);
        });
    });
}

function updateMiniMetrics(totalTests, avgScore) {
    document.getElementById("student-total-tests").innerText = totalTests;
    document.getElementById("student-avg-score").innerText = `${avgScore}%`;
}

function listenToLiveExamChannels() {
    const liveExamRef = ref(db, 'liveExam');
    activeExamListener = onValue(liveExamRef, async (snapshot) => {
        if (!snapshot.exists()) {
            renderExamStatusBox(null);
            return;
        }

        const liveData = snapshot.val();
        renderExamStatusBox(liveData);

        // Control del Ciclo de Vida del Estudiante frente al Examen en Vivo
        if (liveData.status === "active") {
            // Verificar si ya envió este examen para mandarlo a espera
            const subCheck = await get(ref(db, `results/${liveData.testId}/${currentUser.username}`));
            if (subCheck.exists()) {
                switchView("view-waiting-results");
                return;
            }

            // Comprobar si el alumno ya tiene un progreso intermedio en base de datos (Restauración Activa)
            const progressSnap = await get(ref(db, `liveProgress/${liveData.testId}/${currentUser.username}`));
            
            if (views.examEnv.classList.contains("active")) {
                // Ya está dentro del entorno, no reiniciar arreglos, solo actualizar si es necesario
            } else {
                // Ingreso o restauración inicial al examen bloqueado
                initStudentExamWorkspace(liveData, progressSnap.exists() ? progressSnap.val() : null);
            }
        } else if (liveData.status === "results_unlocked") {
            clearInterval(localExamState.timerInterval);
            setupStudentSession(); // Forzar recarga de historial para ver el PDF liberado
        } else if (liveData.status === "stopped") {
            clearInterval(localExamState.timerInterval);
            switchView("view-student-dashboard");
        }
    });
}

function renderExamStatusBox(liveData) {
    const container = document.getElementById("exam-status-container");
    if (!liveData || liveData.status === "stopped") {
        container.className = "status-box empty";
        container.innerHTML = `<p>No hay ninguna evaluación activa en este momento. Espera a que tu docente inicie el test.</p>`;
        return;
    }

    if (liveData.status === "active") {
        container.className = "status-box active-live";
        container.innerHTML = `
            <h4 style="color: var(--success)">🔴 ¡EVALUACIÓN EN CURSO!</h4>
            <p style="margin: 0.5rem 0 1rem 0"><strong>${liveData.title}</strong></p>
            <button id="btn-join-exam" class="btn btn-success btn-sm">Entrar a Responder Ahora</button>
        `;
        
        document.getElementById("btn-join-exam").addEventListener("click", () => {
            // Forzar entrada controlada
            if(liveData.status === "active") {
                switchView("view-exam-environment");
            }
        });
    }
}

/* ==========================================================================
   WORKSPACE DE EXAMEN: RENDERIZACIÓN DINÁMICA Y GUARDADO ATÓMICO INTERMEDIO
   ========================================================================== */

function initStudentExamWorkspace(liveData, savedProgress) {
    document.getElementById("exam-title-display").innerText = liveData.title;
    switchView("view-exam-environment");

    // Reconstruir o restaurar set de preguntas
    if (savedProgress && savedProgress.questionsized) {
        localExamQuestions = savedProgress.questionsized;
        localExamState.answers = savedProgress.answers || {};
        localExamState.currentIndex = savedProgress.currentIndex || 0;
    } else {
        // Primera entrada: Aleatorizar preguntas y aleatorizar opciones internamente
        const baseQuestions = liveData.questions;
        localExamQuestions = shuffleArray(baseQuestions).map(q => {
            return {
                ...q,
                shuffledOptions: shuffleArray(q.options)
            };
        });
        localExamState.answers = {};
        localExamState.currentIndex = 0;
        
        // Sincronizar estado inicial a Firebase para protección ante caídas
        saveCurrentProgressToFirebase(liveData.testId);
    }

    // Sistema de Temporizador Sincrónico Relativo a Estampa de Tiempo del Servidor
    const elapsedSeconds = Math.floor((Date.now() - liveData.startedAt) / 1000);
    const totalDurationSeconds = liveData.duration * 60;
    localExamState.secondsLeft = totalDurationSeconds - elapsedSeconds;

    clearInterval(localExamState.timerInterval);
    if (localExamState.secondsLeft <= 0) {
        autoSubmitExam(liveData.testId, liveData.title);
    } else {
        localExamState.timerInterval = setInterval(() => {
            localExamState.secondsLeft--;
            renderClock();
            if (localExamState.secondsLeft <= 0) {
                clearInterval(localExamState.timerInterval);
                autoSubmitExam(liveData.testId, liveData.title);
            }
        }, 1000);
    }

    renderCurrentQuestion(liveData.testId, liveData.title);
}

function renderClock() {
    const mins = Math.floor(localExamState.secondsLeft / 60).toString().padStart(2, '0');
    const secs = (localExamState.secondsLeft % 60).toString().padStart(2, '0');
    document.getElementById("exam-timer-clock").innerText = `${mins}:${secs}`;
}

function renderCurrentQuestion(testId, testTitle) {
    const total = localExamQuestions.length;
    const current = localExamState.currentIndex;
    
    document.getElementById("current-q-index").innerText = current + 1;
    document.getElementById("total-q-count").innerText = total;

    // Barra de Progreso Matemática
    const progressPerc = ((current) / total) * 100;
    document.getElementById("exam-progress-fill").style.width = `${progressPerc}%`;

    const qData = localExamQuestions[current];
    document.getElementById("question-text-display").innerText = qData.text;

    const optionsGrid = document.getElementById("options-grid");
    optionsGrid.innerHTML = "";

    qData.shuffledOptions.forEach((opt, idx) => {
        const prefix = String.fromCharCode(65 + idx); // A, B, C, D
        const btn = document.createElement("button");
        btn.className = "option-btn";
        if (localExamState.answers[qData.id] === opt) {
            btn.classList.add("selected");
        }

        btn.innerHTML = `
            <span class="option-prefix">${prefix}</span>
            <span class="option-body-text">${opt}</span>
        `;

        btn.addEventListener("click", () => {
            localExamState.answers[qData.id] = opt;
            // Guardar progreso intermedio reactivamente
            saveCurrentProgressToFirebase(testId);
            
            // Animación y paso automático a la siguiente pregunta tras breve delay UX
            setTimeout(() => {
                if (localExamState.currentIndex < total - 1) {
                    localExamState.currentIndex++;
                    renderCurrentQuestion(testId, testTitle);
                } else {
                    // Fin del cuestionario, procesar envío final definitivo
                    processFinalSubmission(testId, testTitle);
                }
            }, 250);
        });

        optionsGrid.appendChild(btn);
    });
}

async function saveCurrentProgressToFirebase(testId) {
    const progressRef = ref(db, `liveProgress/${testId}/${currentUser.username}`);
    await set(progressRef, {
        questionsized: localExamQuestions,
        answers: localExamState.answers,
        currentIndex: localExamState.currentIndex,
        timestamp: Date.now()
    });
}

async function processFinalSubmission(testId, testTitle) {
    clearInterval(localExamState.timerInterval);
    
    // Calificación Algorítmica con IDs Internos Inalterables por el Shuffler
    let correctCount = 0;
    const totalQuestions = localExamQuestions.length;
    const breakdown = {};

    localExamQuestions.forEach(q => {
        const selected = localExamState.answers[q.id] || null;
        const isCorrect = (selected === q.correctAnswer);
        if (isCorrect) correctCount++;
        
        breakdown[q.id] = {
            questionText: q.text,
            selected: selected,
            correctAnswer: q.correctAnswer,
            status: isCorrect
        };
    });

    const percentage = Math.round((correctCount / totalQuestions) * 100);

    const payloadResult = {
        username: currentUser.username,
        fullname: currentUser.fullname,
        level: currentUser.level,
        testId,
        testTitle,
        score: correctCount,
        totalQuestions,
        percentage,
        answersBreakdown: breakdown,
        timestamp: Date.now()
    };

    // Almacenamiento Atómico en Nodo de Resultados
    await set(ref(db, `results/${testId}/${currentUser.username}`), payloadResult);
    
    // Limpieza de estados temporales
    await set(ref(db, `liveProgress/${testId}/${currentUser.username}`), null);

    switchView("view-waiting-results");
}

function autoSubmitExam(testId, testTitle) {
    alert("⌛ El tiempo asignado a la evaluación ha finalizado de forma estricta.");
    processFinalSubmission(testId, testTitle);
}

/* ==========================================================================
   MÓDULO PANEL ADMINISTRATIVO: PARSER TXT E INTELIGENCIA DE DATOS (REALTIME)
   ========================================================================== */

function initAdminEvents() {
    // Activador del Trigger Oculto de Administración
    document.getElementById("admin-trigger").addEventListener("click", () => {
        const token = prompt("Ingrese la clave maestra de acceso técnico administrativo:");
        if (token === "admin123" || token === "musitest2026") {
            currentRole = "admin";
            switchView("view-admin-dashboard");
            setupAdminDashboard();
        } else {
            alert("Acceso estrictamente denegado.");
        }
    });

    document.getElementById("btn-admin-exit").addEventListener("click", () => {
        switchView("view-auth");
    });

    // Controlador de Tabs Administrativos
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".admin-sub-view").forEach(v => v.classList.remove("active"));
            
            e.target.classList.add("active");
            const targetId = e.target.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");
        });
    });

    // PARSER INTELIGENTE DE PREGUNTAS EN FORMATO REGEX OFICIAL
    document.getElementById("btn-parse-import").addEventListener("click", async () => {
        const title = document.getElementById("admin-test-title").value.trim();
        const rawText = document.getElementById("admin-txt-area").value.trim();

        if (!title || !rawText) return alert("Complete el título y el cuerpo del cuestionario.");

        try {
            // Split por bloques numéricos de preguntas
            const questionBlocks = rawText.split(/\n(?=\d+\.)/);
            const parsedQuestions = [];

            questionBlocks.forEach((block, qIdx) => {
                const lines = block.split("\n").map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length < 2) return;

                // Extraer el texto de la pregunta quitando el índice numérico inicial
                const text = lines[0].replace(/^\d+\.\s*/, "");
                const options = [];
                let correctAnswer = null;

                // Parsear las opciones (Líneas subsiguientes)
                for (let i = 1; i < lines.length; i++) {
                    let line = lines[i];
                    // Remover prefijo de incisos comunes (A., B., C., D.) si existen
                    line = line.replace(/^[A-Da-d]\.\s*/, "");

                    // Validación de Regla Importante: Marcador " R" o "R" al final
                    const isCorrect = /[\s+]R$/i.test(line) || line.endsWith("R");
                    // Limpiar visualmente el marcador del texto final
                    const cleanOptionText = line.replace(/(\s+R|R)$/i, "").trim();

                    options.push(cleanOptionText);
                    if (isCorrect) {
                        correctAnswer = cleanOptionText;
                    }
                }

                if (!correctAnswer && options.length > 0) {
                    // Fallback de seguridad: si no detecta la "R", asume la primera opción
                    correctAnswer = options[0];
                }

                parsedQuestions.push({
                    id: `q_${Date.now()}_${qIdx}`,
                    text,
                    options,
                    correctAnswer
                });
            });

            if (parsedQuestions.length === 0) throw new Error("No se estructuró ninguna pregunta válida.");

            const testId = `test_${Date.now()}`;
            const testPayload = {
                id: testId,
                title,
                questions: parsedQuestions,
                createdAt: Date.now()
            };

            await set(ref(db, `tests/${testId}`), testPayload);
            alert(`¡Éxito! Test creado con ${parsedQuestions.length} preguntas estructuradas.`);
            
            document.getElementById("admin-test-title").value = "";
            document.getElementById("admin-txt-area").value = "";
            
            loadAdminLibrary();
        } catch (err) {
            alert("Error en el formato del Parser. Verifique el instructivo estructural.");
        }
    });

    // Control de Flujos Operativos Live de Servidor
    document.getElementById("btn-admin-launch").addEventListener("click", async () => {
        const testId = document.getElementById("admin-active-test-selector").value;
        const duration = parseInt(document.getElementById("admin-exam-duration").value);

        if (!testId) return alert("Seleccione un test de la biblioteca para lanzar.");
        if (!duration || duration < 1) return alert("Asigne una duración válida.");

        const snapTest = await get(ref(db, `tests/${testId}`));
        const testData = snapTest.val();

        const livePayload = {
            status: "active",
            testId: testData.id,
            title: testData.title,
            duration: duration,
            startedAt: Date.now(),
            questions: testData.questions // Preguntas base sin mezclar
        };

        await set(ref(db, "liveExam"), livePayload);
        alert("🚀 ¡Examen lanzado! Las pantallas de los estudiantes se bloquearán en modo examen.");
    });

    document.getElementById("btn-admin-stop").addEventListener("click", async () => {
        if (!confirm("¿Está seguro de forzar el cierre definitivo del examen en curso?")) return;
        await update(ref(db, "liveExam"), { status: "stopped" });
    });

    document.getElementById("btn-admin-unlock-results").addEventListener("click", async () => {
        await update(ref(db, "liveExam"), { status: "results_unlocked" });
        alert("🔓 Resultados desbloqueados. Los estudiantes pueden visualizar sus notas e historial.");
    });

    document.getElementById("btn-admin-reset-system").addEventListener("click", async () => {
        if (!confirm("¿Desea limpiar el canal en vivo de Firebase por completo?")) return;
        await set(ref(db, "liveExam"), null);
        await set(ref(db, "liveProgress"), null);
        alert("Sistema reseteado a estado pasivo.");
    });
}

function setupAdminDashboard() {
    loadAdminLibrary();
    loadAdminStudents();
    initLiveSystemMonitor();
}

async function loadAdminLibrary() {
    const snapshot = await get(ref(db, "tests"));
    const tbody = document.getElementById("admin-library-tbody");
    const selector = document.getElementById("admin-active-test-selector");
    
    tbody.innerHTML = "";
    selector.innerHTML = `<option value="">-- Seleccionar de la Biblioteca --</option>`;

    if (!snapshot.exists()) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Biblioteca vacía.</td></tr>`;
        return;
    }

    snapshot.forEach(childSnap => {
        const test = childSnap.val();
        
        // Llenar tabla
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${test.title}</strong></td>
            <td>${test.questions ? test.questions.length : 0} ítems</td>
            <td><code>${test.id}</code></td>
            <td>
                <button class="btn btn-danger btn-sm btn-del-test" data-id="${test.id}">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);

        // Llenar selector live
        const opt = document.createElement("option");
        opt.value = test.id;
        opt.innerText = test.title;
        selector.appendChild(opt);
    });

    // Registrar manejadores de eliminación
    document.querySelectorAll(".btn-del-test").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm("¿Eliminar este examen de la biblioteca de forma permanente?")) {
                await set(ref(db, `tests/${id}`), null);
                loadAdminLibrary();
            }
        });
    });
}

async function loadAdminStudents() {
    const snapshot = await get(ref(db, "students"));
    const tbody = document.getElementById("admin-students-tbody");
    tbody.innerHTML = "";

    if (!snapshot.exists()) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay estudiantes registrados.</td></tr>`;
        return;
    }

    snapshot.forEach(childSnap => {
        const st = childSnap.val();
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><code>${st.username}</code></td>
            <td>${st.password}</td>
            <td>${st.fullname}</td>
            <td>${st.level}</td>
            <td>
                <button class="btn btn-danger btn-sm btn-del-student" data-user="${st.username}">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-del-student").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const user = e.target.getAttribute("data-user");
            if (confirm(`¿Dar de baja al estudiante ${user}?`)) {
                await set(ref(db, `students/${user}`), null);
                loadAdminStudents();
            }
        });
    });
}

function initLiveSystemMonitor() {
    // Doble enlace en tiempo real al estado de la evaluación y los envíos
    onValue(ref(db, "liveExam"), async (liveSnap) => {
        const btnLaunch = document.getElementById("btn-admin-launch");
        const btnStop = document.getElementById("btn-admin-stop");
        const btnUnlock = document.getElementById("btn-admin-unlock-results");

        if (!liveSnap.exists() || liveSnap.val().status === "stopped") {
            btnLaunch.disabled = false;
            btnStop.disabled = true;
            btnUnlock.disabled = true;
            document.getElementById("admin-monitor-tbody").innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay exámenes activos en este ciclo.</td></tr>`;
            return;
        }

        const liveData = liveSnap.val();
        
        if (liveData.status === "active") {
            btnLaunch.disabled = true;
            btnStop.disabled = false;
            btnUnlock.disabled = false;
        } else if (liveData.status === "results_unlocked") {
            btnLaunch.disabled = true;
            btnStop.disabled = false;
            btnUnlock.disabled = true;
        }

        // Leer respuestas en vivo para pintar el dashboard de control en tiempo real
        onValue(ref(db, `results/${liveData.testId}`), (resultsSnap) => {
            onValue(ref(db, `liveProgress/${liveData.testId}`), (progressSnap) => {
                renderLiveMonitorTable(resultsSnap.val(), progressSnap.val(), liveData);
            });
        });
    });
}

function renderLiveMonitorTable(resultsData, progressData, liveData) {
    const tbody = document.getElementById("admin-monitor-tbody");
    tbody.innerHTML = "";

    resultsData = resultsData || {};
    progressData = progressData || {};

    const allUsernames = new Set([
        ...Object.keys(resultsData),
        ...Object.keys(progressData)
    ]);

    if (allUsernames.size === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Esperando la conexión del primer estudiante...</td></tr>`;
        updateAdminMetrics(0, 0, 0);
        return;
    }

    let finishedCount = 0;
    let totalScoreSum = 0;

    allUsernames.forEach(username => {
        const isDone = !!resultsData[username];
        const data = isDone ? resultsData[username] : progressData[username];
        
        // Determinar métricas de fila única contenidas estrictamente en celdas individuales
        let progressStr = "";
        let scoreStr = "";
        let statusBadge = "";
        let timeStr = "---";

        if (isDone) {
            finishedCount++;
            totalScoreSum += data.percentage;
            progressStr = `Completado (${data.score}/${data.totalQuestions})`;
            scoreStr = `<strong>${data.percentage}%</strong>`;
            statusBadge = `<span class="badge" style="background-color:#d1fae5; color:#065f46">Entregado</span>`;
            timeStr = new Date(data.timestamp).toLocaleTimeString();
        } else {
            // El estudiante sigue resolviendo en tiempo real (Live Progress)
            const answeredCount = Object.keys(data.answers || {}).length;
            const totalQ = data.questionsized ? data.questionsized.length : liveData.questions.length;
            progressStr = `Respondiendo: ${answeredCount} de ${totalQ}`;
            scoreStr = `<span class="text-muted">Calculando...</span>`;
            statusBadge = `<span class="badge" style="background-color:#fef3c7; color:#92400e">En Vivo</span>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${data.fullname || username}</strong></td>
            <td>${data.level || '---'}</td>
            <td>${progressStr}</td>
            <td>${timeStr}</td>
            <td>${scoreStr}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    const globalAvg = finishedCount > 0 ? Math.round(totalScoreSum / finishedCount) : 0;
    updateAdminMetrics(allUsernames.size, finishedCount, globalAvg);
}

function updateAdminMetrics(connected, finished, average) {
    document.getElementById("admin-count-connected").innerText = connected;
    document.getElementById("admin-count-finished").innerText = finished;
    document.getElementById("admin-global-average").innerText = `${average}%`;
}

/* ==========================================================================
   MOTOR NATIVO DE GENERACIÓN DE INFORMES E IMPRESIÓN SCRIPT/CSS (PDF EXPORT)
   ========================================================================== */

async function generateNativePDFReport(testId) {
    const snapshot = await get(ref(db, `results/${testId}/${currentUser.username}`));
    if (!snapshot.exists()) return alert("No se localizó el registro de la evaluación.");

    const res = snapshot.val();
    const printContainer = document.getElementById("print-report-container");
    
    let breakdownHtml = "";
    Object.keys(res.answersBreakdown).forEach((key, idx) => {
        const item = res.answersBreakdown[key];
        breakdownHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.questionText}</td>
                <td>${item.selected || '<span style="color:red">No Respondido</span>'}</td>
                <td>${item.correctAnswer}</td>
                <td style="font-weight:bold; color:${item.status ? 'green' : 'red'}">${item.status ? 'CORRECTO' : 'INCORRECTO'}</td>
            </tr>
        `;
    });

    // Inyectar estructura limpia libre de artefactos de interfaz móvil
    printContainer.innerHTML = `
        <div class="print-card-header" style="text-align:center; font-family:sans-serif;">
            <h1 style="margin-bottom:2px; color:#4c1d95;">🎼 PLATAFORMA MUSITEST</h1>
            <h2 style="margin-top:0; font-weight:500;">REPORTE DE EVALUACIÓN ACADÉMICA OFICIAL</h2>
            <hr style="border:1px solid #000; margin: 15px 0;"/>
        </div>
        <table style="width:100%; font-family:sans-serif; font-size:14px; margin-bottom:20px; line-height:1.6;">
            <tr>
                <td><strong>Estudiante:</strong> ${res.fullname}</td>
                <td><strong>Nivel Institucional:</strong> ${res.level}</td>
            </tr>
            <tr>
                <td><strong>Evaluación:</strong> ${res.testTitle}</td>
                <td><strong>Fecha de Emisión:</strong> ${new Date(res.timestamp).toLocaleString()}</td>
            </tr>
            <tr>
                <td><strong>Puntaje Obtenido:</strong> ${res.score} / ${res.totalQuestions}</td>
                <td><strong>Porcentaje de Rendimiento:</strong> <span style="font-size:16px; font-weight:bold;">${res.percentage}%</span></td>
            </tr>
        </table>
        <h3 style="font-family:sans-serif; margin-bottom:5px;">Desglose Analítico de Respuestas</h3>
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width:5%">Índice</th>
                    <th style="width:45%">Pregunta Evaluada</th>
                    <th style="width:20%">Tu Respuesta</th>
                    <th style="width:20%">Respuesta Correcta</th>
                    <th style="width:10%">Estado</th>
                </tr>
            </thead>
            <tbody>
                ${breakdownHtml}
            </tbody>
        </table>
        <div style="margin-top:50px; text-align:center; font-family:sans-serif; font-size:11px; color:#555;">
            <p>Reporte digital automatizado emitido de forma conforme por Musitest Core Engine.</p>
            <p style="font-weight:bold; margin-top:15px;">Firma del Evaluador Académico</p>
        </div>
    `;

    // Ejecutar llamada al subsistema de impresión del sistema operativo
    window.print();
}

/* ==========================================================================
   INICIALIZADOR BOOTSTRAP GENERAL
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initAuthEvents();
    initAdminEvents();
});