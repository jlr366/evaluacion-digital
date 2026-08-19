const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'examen-aws'
});

const db = admin.firestore();
const HASH_ROUNDS = 10;
const bcrypt = require('bcryptjs');

async function createLiveExamClase4() {
  try {
    // Find jlrazure admin user
    console.log('Looking for jlrazure admin...');
    let adminSnap = await db.collection('admins').where('username', '==', 'jlrazure').get();

    let adminDoc;
    let adminId;

    if (!adminSnap.empty) {
      adminDoc = adminSnap.docs[0];
      adminId = adminDoc.id;
      console.log('Found existing jlrazure admin:', adminId);
    } else {
      const passwordHash = bcrypt.hashSync('Bestias300', HASH_ROUNDS);
      const ref = await db.collection('admins').add({
        username: 'jlrazure',
        passwordHash,
        nombre: 'JL Rodriguez',
        role: 'admin',
        institucion: 'Azure Course',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      adminId = ref.id;
      console.log('Created new jlrazure admin:', adminId);
    }

    // 15 questions based on Class 4 content
    const preguntas = [
      {
        pregunta: "¿Qué es IoT (Internet of Things) en el contexto de Azure?",
        opciones: [
          "Un servicio de bases de datos para sensores",
          "La capacidad de dispositivos de recopilar información y transmitirla para análisis y toma de decisiones",
          "Un tipo de almacenamiento para archivos grandes",
          "Un servicio de red privada virtual"
        ],
        correcta: 1,
        explicacion: "IoT = dispositivos que miden (temperatura, vibración, ubicación, consumo) → transmiten datos → análisis → acción/decisiones. No es solo el sensor, es el ciclo completo.",
        tiempo: 30
      },
      {
        pregunta: "¿Cuál es la diferencia principal entre Azure IoT Hub y Azure IoT Central?",
        opciones: [
          "IoT Hub es SaaS, IoT Central es PaaS",
          "IoT Hub es centro de mensajes bidireccional; IoT Central es plataforma SaaS administrada para operar IoT a gran escala",
          "IoT Hub es para seguridad, IoT Central para mensajería",
          "No hay diferencia, son el mismo servicio"
        ],
        correcta: 1,
        explicacion: "IoT Hub = 'cartero' de mensajería bidireccional (dispositivo ↔ nube). IoT Central = plataforma SaaS lista para operar IoT a escala (dashboards, alertas, plantillas, gestión de activos).",
        tiempo: 30
      },
      {
        pregunta: "¿Qué servicio de Azure se enfoca especialmente en la SEGURIDAD de dispositivos IoT conectados a internet?",
        opciones: [
          "Azure IoT Hub",
          "Azure IoT Central",
          "Azure Sphere",
          "Azure Functions"
        ],
        correcta: 2,
        explicacion: "Azure Sphere = seguridad + plataforma para dispositivos IoT. IoT Hub y IoT Central se enfocan en conectividad/operación; Sphere en seguridad del dispositivo.",
        tiempo: 25
      },
      {
        pregunta: "¿Qué es Azure Synapse Analytics conceptualmente?",
        opciones: [
          "Un servicio de Machine Learning",
          "Un Data Warehouse + servicio de análisis empresarial en la nube",
          "Un servicio de IoT para dispositivos",
          "Una herramienta de CI/CD"
        ],
        correcta: 1,
        explicacion: "Synapse = Data Warehouse + analítica empresarial. Integra datos, los prepara y permite consultas para BI/reportes/KPIs (ej: ventas por región, productos con más demanda).",
        tiempo: 30
      },
      {
        pregunta: "Azure Databricks está basado en qué tecnología de código abierto?",
        opciones: [
          "Apache Kafka",
          "Apache Spark",
          "Apache Hadoop",
          "Apache Flink"
        ],
        correcta: 1,
        explicacion: "Databricks = Spark administrado. Spark = motor de procesamiento distribuido para transformar/limpiar/normalizar datos a escala (ETL/ELT).",
        tiempo: 25
      },
      {
        pregunta: "¿Cuál es la diferencia conceptual entre Azure Machine Learning y Cognitive Services?",
        opciones: [
          "No hay diferencia, son lo mismo",
          "ML: entrenas modelos con TUS datos; Cognitive Services: usas capacidades IA YA LISTAS (visión, voz, lenguaje)",
          "ML es para bots, Cognitive es para datos",
          "ML es gratis, Cognitive cuesta dinero"
        ],
        correcta: 1,
        explicacion: "Machine Learning = entrenas/evalúas/implementas modelos PROPIOS con tus datos. Cognitive Services = capacidades IA pre-entrenadas (ver imágenes, entender texto, procesar voz) que llamas como API.",
        tiempo: 30
      },
      {
        pregunta: "¿Qué significa 'Serverless' en Azure?",
        opciones: [
          "No hay servidores físicos en Azure",
          "Tú no administras servidores; ejecutas lógica bajo demanda y la plataforma gestiona infraestructura",
          "Los servicios son gratuitos",
          "Solo funciona con contenedores Docker"
        ],
        correcta: 1,
        explicacion: "Serverless = tú te concentras en la lógica/negocio; Azure gestiona infraestructura, escalado, disponibilidad. Cobro por uso real.",
        tiempo: 25
      },
      {
        pregunta: "¿Cuál es la diferencia principal entre Azure Functions y Azure Logic Apps?",
        opciones: [
          "Functions es para flujos multi-paso; Logic Apps para una tarea puntual",
          "Functions = código por eventos (tarea puntual); Logic Apps = orquestación de pasos/flujos de trabajo entre servicios",
          "Functions usa C#; Logic Apps usa JavaScript",
          "No hay diferencia"
        ],
        correcta: 1,
        explicacion: "Functions: una pieza de lógica disparada por evento (HTTP, archivo, mensaje, timer). Logic Apps: orquestación visual 'si esto → haz aquello → luego aquello otro' conectando múltiples servicios.",
        tiempo: 30
      },
      {
        pregunta: "¿Qué conjunto describe correctamente los servicios principales de Azure DevOps?",
        opciones: [
          "Azure Boards, Azure Repos, Azure Pipelines, Azure Test Plans y Azure Artifacts",
          "Azure Virtual Machines, Azure Storage, Azure SQL Database y Azure DNS",
          "Azure IoT Hub, Azure Sphere, Azure Functions y Azure Stream Analytics",
          "Azure Firewall, Azure VPN Gateway, Azure Bastion y Azure DDoS Protection"
        ],
        correcta: 0,
        explicacion: "Azure DevOps reúne servicios para planificar, colaborar, controlar código, automatizar CI/CD, probar y administrar paquetes: Boards, Repos, Pipelines, Test Plans y Artifacts.",
        tiempo: 25
      },
      {
        pregunta: "¿Para qué sirve GitHub Actions for Azure?",
        opciones: [
          "Para crear repositorios Git",
          "Automatiza flujos CI/CD desde GitHub: compilar, probar, empacar e implementar en Azure",
          "Para administrar máquinas virtuales",
          "Para monitorear aplicaciones"
        ],
        correcta: 1,
        explicacion: "GitHub Actions = motor de automatización CI/CD. 'Cuando pase algo en GitHub (push, PR, release) → dispare workflow → build/test/deploy a Azure'.",
        tiempo: 25
      },
      {
        pregunta: "¿Qué son las plantillas ARM (Azure Resource Manager)?",
        opciones: [
          "Un tipo de base de datos",
          "Infraestructura como código: describes la infraestructura en una plantilla (receta) y Azure la implementa",
          "Un servicio de monitoreo",
          "Un formato de archivo para blobs"
        ],
        correcta: 1,
        explicacion: "ARM = Infrastructure as Code. Defines recursos en JSON/Bicep → ejecutas → Azure crea todo de forma reproducible, automatizada y consistente.",
        tiempo: 30
      },
      {
        pregunta: "¿Qué hace Azure Advisor?",
        opciones: [
          "Monitorea métricas en tiempo real",
          "Analiza configuraciones y telemetría y sugiere recomendaciones para optimizar: costos, seguridad, confiabilidad, rendimiento, excelencia operativa",
          "Crea alertas automáticas",
          "Despliega recursos"
        ],
        correcta: 1,
        explicacion: "Advisor = motor de recomendaciones (no monitoreo en tiempo real). Prioriza por impacto: 'tienes recursos subutilizados', 'configuración insegura', etc. Te dice QUÉ atender primero.",
        tiempo: 30
      },
      {
        pregunta: "¿Cuáles son los DOS tipos fundamentales de datos en Azure Monitor?",
        opciones: [
          "CPU y Memoria",
          "Métricas (números en el tiempo) y Logs (eventos detallados con contexto)",
          "Alertas y Acciones",
          "Dashboards y Reportes"
        ],
        correcta: 1,
        explicacion: "Métricas = números temporales (CPU%, red, memoria). Logs = eventos detallados (qué pasó, cuándo, contexto). Monitor: recopila → analiza → alerta → actúa (autoscale, notificaciones).",
        tiempo: 30
      },
      {
        pregunta: "¿Qué herramienta ofrece una consola Bash o PowerShell dentro del navegador, sin instalar herramientas localmente?",
        opciones: [
          "Azure PowerShell",
          "Azure CLI",
          "Cloud Shell",
          "Azure Portal"
        ],
        correcta: 2,
        explicacion: "Cloud Shell = consola en el navegador (Bash o PowerShell). Ideal para demos, aprendizaje y administración rápida sin instalar herramientas localmente.",
        tiempo: 20
      },
      {
        pregunta: "Resumen rápido: ¿Cuál es la correspondencia correcta?",
        opciones: [
          "Synapse = Spark administrado; Databricks = Warehouse; HDInsight = Hadoop",
          "Synapse = Warehouse/empresa; Databricks = Spark administrado; HDInsight = Big Data administrado (Hadoop tradicional)",
          "Synapse = Hadoop; Databricks = Warehouse; HDInsight = Spark",
          "Todos son lo mismo con nombres diferentes"
        ],
        correcta: 1,
        explicacion: "Synapse = enfoque warehouse/empresa + analítica. Databricks = Spark administrado para procesar/transformar. HDInsight = big data administrado con ecosistemas tipo Hadoop tradicional.",
        tiempo: 30
      }
    ];

    const examData = {
      titulo: 'Azure AZ-900 Módulo 3 - Soluciones Core (Clase 4)',
      subtitulo: 'Examen en vivo estilo Kahoot - 15 preguntas: IoT, Analytics, IA, Serverless, DevOps, Admin/Monitor',
      tiempoMinutos: 45,
      notaMinima: 70,
      notaMaxima: 100,
      reconexionMinutos: 60,
      puntuacion: 'igual',
      intentosPermitidos: 0,
      fechaApertura: '',
      fechaCierre: '',
      preguntas: preguntas,
      createdBy: adminId,
      createdByName: 'JL Rodriguez',
      institucion: 'Azure Course',
      imgAprobado: '',
      imgReprobado: '',
      audioExamen: '',
      audioAprobado: '',
      audioReprobado: '',
      permitirDescarga: true,
      accesoLibre: false,
      esVivo: true,
      activo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const examRef = await db.collection('examenes').add(examData);
    console.log('✅ Examen CLASE 4 creado con ID:', examRef.id);
    console.log('Titulo:', examData.titulo);
    console.log('Preguntas:', preguntas.length);
    console.log('esVivo:', examData.esVivo);
    console.log('');
    console.log('Usuario: jlrazure');
    console.log('Password: Bestias300');
    console.log('');
    console.log('El examen ya está disponible en la pestaña "Exámenes en vivo" del panel admin.');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createLiveExamClase4();