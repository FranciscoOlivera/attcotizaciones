/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
} from './services/auth';
import { Header } from './components/Header';
import { AutomationConfigBar } from './components/AutomationConfigBar';
import { GmailInboxViewer } from './components/GmailInboxViewer';
import { CentralDatabaseTable } from './components/CentralDatabaseTable';
import { SyncReportViewer } from './components/SyncReportViewer';
import { CotizadorWhatsApp } from './components/CotizadorWhatsApp';
import { PlansManager } from './components/PlansManager';
import {
  searchPriceListEmails,
  downloadGmailAttachment,
  sendSyncSummaryEmail,
} from './services/gmailService';
import {
  createCentralDatabaseSpreadsheet,
  syncPricesToGoogleSheet,
  getSpreadsheetMetadata,
} from './services/sheetsService';
import { extractATTPriceList } from './services/excelExtractor';
import { computePriceDifferences } from './services/diffService';
import { loadPlans, savePlans } from './services/plansService';
import {
  DevicePriceRecord,
  DetectedEmailMessage,
  SyncExecutionReport,
  ATTPlan,
} from './types/pricing';
import { getInitialCentralRecords } from './utils/initialData';
import { deduplicateDeviceRecords } from './utils/recordDeduplicator';
import { createSampleATTExcelBuffer } from './utils/sampleExcelGenerator';
import { idbGet, idbSet, purgeHighVolumeLocalStorage } from './services/dbStorage';
import {
  Mail,
  Database,
  FileCheck,
  History,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Tag,
  MessageCircle,
  AlertTriangle,
  Lock,
  Megaphone,
  Radio,
  X,
} from 'lucide-react';
import { FacebookAdsGenerator } from './components/FacebookAdsGenerator';

const safeSetItem = (key: string, val: string) => {
  try {
    localStorage.setItem(key, val);
  } catch (e) {
    console.warn(`localStorage save skipped for ${key}:`, e);
  }
};

export default function App() {
  // Theme State (Dark / Light Mode)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('att_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('att_theme', next);
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Mobile Menu Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App Navigation: Default to 'cotizador'
  const [activeTab, setActiveTab] = useState<'cotizador' | 'facebook' | 'database' | 'planes' | 'inbox' | 'report' | 'history'>('cotizador');

  // Navigation Category grouping
  type NavCategory = 'ventas' | 'catalogo' | 'automatizacion';
  const [activeCategory, setActiveCategory] = useState<NavCategory>('ventas');

  // Synchronize category with activeTab
  useEffect(() => {
    if (activeTab === 'cotizador' || activeTab === 'facebook') {
      setActiveCategory('ventas');
    } else if (activeTab === 'database' || activeTab === 'planes') {
      setActiveCategory('catalogo');
    } else {
      setActiveCategory('automatizacion');
    }
  }, [activeTab]);

  // Plans Management State: No default prices unless linked
  const [plans, setPlans] = useState<ATTPlan[]>(() => loadPlans());

  // Central Database State: Managed safely via IndexedDB (eliminates QuotaExceededError)
  const [records, setRecords] = useState<DevicePriceRecord[]>(() => getInitialCentralRecords());

  // Selected device for quoter
  const [selectedRecordForQuote, setSelectedRecordForQuote] = useState<DevicePriceRecord | null>(null);

  // Google Sheets Config: Never disconnects automatically (saved persistently)
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    try {
      return localStorage.getItem('att_spreadsheet_id') || '';
    } catch {
      return '';
    }
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('att_spreadsheet_url') || '';
    } catch {
      return '';
    }
  });
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  // Email Recipient Config
  const [recipientEmail, setRecipientEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('att_recipient_email') || 'UserTotix98@gmail.com';
    } catch {
      return 'UserTotix98@gmail.com';
    }
  });

  // Gmail Inbox State
  const [emails, setEmails] = useState<DetectedEmailMessage[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeProcessingId, setActiveProcessingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync Reports State
  const [reports, setReports] = useState<SyncExecutionReport[]>([]);
  const [latestReport, setLatestReport] = useState<SyncExecutionReport | null>(null);

  // Load persisted records and reports from IndexedDB on initial mount & purge congested localStorage
  useEffect(() => {
    let isMounted = true;
    // Clear out congested localStorage keys that triggered QuotaExceededError
    purgeHighVolumeLocalStorage();

    // Asynchronously load records from IndexedDB
    idbGet<DevicePriceRecord[]>('att_central_records').then((saved) => {
      if (isMounted && saved && Array.isArray(saved) && saved.length > 0) {
        setRecords(
          deduplicateDeviceRecords(
            saved.map((r) => ({
              ...r,
              precioPromocion: Number(r.precioPromocion || 0),
              costoPlan: Number(r.costoPlan || 0),
              engancheMaximo: Number(r.engancheMaximo || 0),
              mensualidadTotalConMaxEnganche: Number(r.mensualidadTotalConMaxEnganche || 0),
              mensualidadEquipoConMaxEnganche: Number(r.mensualidadEquipoConMaxEnganche || 0),
              plazo: Number(r.plazo || 36),
            }))
          )
        );
      }
    });

    // Asynchronously load reports from IndexedDB
    idbGet<SyncExecutionReport[]>('att_sync_reports').then((savedReports) => {
      if (isMounted && savedReports && Array.isArray(savedReports) && savedReports.length > 0) {
        setReports(savedReports);
        setLatestReport(savedReports[0]);
      }
    });

    // Hydrate master state from backend server so ANY visitor immediately sees latest prices without login
    const syncWithServer = async () => {
      try {
        const res = await fetch('/api/sync/state');
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data.records) && data.records.length > 0) {
            setRecords(deduplicateDeviceRecords(data.records));
          }
          if (Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans);
          }
          if (data.latestReport) {
            setLatestReport(data.latestReport);
          }
          if (Array.isArray(data.reports) && data.reports.length > 0) {
            setReports(data.reports);
          }
          if (data.spreadsheetUrl) {
            setSpreadsheetUrl(data.spreadsheetUrl);
          }
        }
      } catch (err) {
        console.warn('Could not sync state with server:', err);
      }
    };

    syncWithServer();
    const interval = setInterval(syncWithServer, 25000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // ALWAYS-ON Email Reader: Default is true so it is always reading incoming emails
  // User request: "necesito que siempre este leyendo ese correo"
  const [isAutoMonitorActive, setIsAutoMonitorActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('att_auto_monitor');
      return saved !== 'false'; // default TRUE
    } catch {
      return true;
    }
  });
  const monitorTimerRef = useRef<any>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  // Persist records to IndexedDB (No 5MB quota limit, safe & resilient)
  useEffect(() => {
    if (records.length > 0) {
      idbSet('att_central_records', records).catch((e) => {
        console.warn('Could not persist records to IndexedDB', e);
      });
    }
  }, [records]);

  // Persist reports to IndexedDB
  useEffect(() => {
    if (reports.length > 0) {
      idbSet('att_sync_reports', reports).catch((e) => {
        console.warn('Could not persist reports to IndexedDB', e);
      });
    }
    if (reports.length > 0 && !latestReport) {
      setLatestReport(reports[0]);
    }
  }, [reports, latestReport]);

  // Persist auto monitor preference
  useEffect(() => {
    try {
      localStorage.setItem('att_auto_monitor', isAutoMonitorActive ? 'true' : 'false');
    } catch {}
  }, [isAutoMonitorActive]);

  // Save plans
  const handlePlansChange = (newPlans: ATTPlan[]) => {
    setPlans(newPlans);
    savePlans(newPlans);
    showToast('Tabla de planes actualizada', 'success');
  };

  // Initialize Auth
  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        if (currentUser.email && !recipientEmail) {
          setRecipientEmail(currentUser.email);
        }
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
  }, [recipientEmail]);

  // Login Handler (Master Authentication)
  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        const email = res.user.email?.toLowerCase();
        
        if (email === 'usertotix98@gmail.com') {
          setRecipientEmail(res.user.email!);
          safeSetItem('att_recipient_email', res.user.email!);

          // Register master token on backend server for 24/7 background sync
          try {
            await fetch('/api/master/register-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: res.accessToken, email: res.user.email }),
            });
            showToast(`¡Bienvenido Administrador (${res.user.email})! Sincronización maestra activa.`, 'success');
          } catch (e) {
            console.warn('Could not register token on server:', e);
            showToast(`Sesión iniciada como ${res.user.email}. Lector de correo activo.`, 'success');
          }
        } else {
          showToast(
            `Iniciaste sesión como ${res.user.email}. El lector automático continúa conectado exclusivamente al buzón oficial de UserTotix98@gmail.com.`,
            'info'
          );
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al iniciar sesión con Google', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    showToast('Sesión cerrada.', 'info');
  };

  // Scan Gmail for matching emails
  const handleScanGmail = useCallback(async (isAutoBackground = false) => {
    if (!accessToken) {
      if (!isAutoBackground) {
        showToast('Por favor inicia sesión para consultar tu bandeja de Gmail.', 'info');
      }
      return;
    }

    try {
      setIsScanning(true);
      const detected = await searchPriceListEmails(accessToken);
      setEmails(detected);

      // ALWAYS-ON AUTO-PROCESS: If an unread/unprocessed email is detected, auto-process it immediately!
      if (detected.length > 0) {
        const unprocessed = detected.find(
          (m) => !m.processed && !processedMessageIdsRef.current.has(m.id) && m.attachments.length > 0
        );

        if (unprocessed) {
          processedMessageIdsRef.current.add(unprocessed.id);
          showToast(
            `¡Nuevo correo detectado! "${unprocessed.subject}". Procesando automáticamente la hoja "Promociones AT&T Premium"...`,
            'info'
          );
          const att = unprocessed.attachments[0];
          const bytes = await downloadGmailAttachment(accessToken, unprocessed.id, att.id);
          await processExcelData(bytes, att.filename, {
            emailId: unprocessed.id,
            subject: unprocessed.subject,
            sender: unprocessed.sender,
          });
        } else if (!isAutoBackground) {
          showToast(`Se encontraron ${detected.length} correos con "LISTA DE PRECIOS"`, 'success');
        }
      } else if (!isAutoBackground) {
        showToast('No se encontraron correos nuevos con el asunto "LISTA DE PRECIOS".', 'info');
      }
    } catch (err: any) {
      console.error(err);
      if (!isAutoBackground) {
        showToast(`Error al consultar Gmail: ${err.message}`, 'error');
      }
    } finally {
      setIsScanning(false);
    }
  }, [accessToken]);

  // Initial scan when token becomes available
  useEffect(() => {
    if (accessToken) {
      handleScanGmail(false);
    }
  }, [accessToken, handleScanGmail]);

  // CONTINUOUS BACKGROUND EMAIL READER (runs every 30 seconds while active)
  // User request: "necesito que siempre este leyendo ese correo"
  useEffect(() => {
    if (isAutoMonitorActive && accessToken) {
      monitorTimerRef.current = setInterval(() => {
        handleScanGmail(true); // run in background
      }, 30000); // 30 seconds
    } else {
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
      }
    }
    return () => {
      if (monitorTimerRef.current) clearInterval(monitorTimerRef.current);
    };
  }, [isAutoMonitorActive, accessToken, handleScanGmail]);

  // Create Google Sheet central database
  const handleCreateSpreadsheet = async () => {
    if (!accessToken) {
      showToast('Inicia sesión para crear la base central en Google Sheets', 'info');
      return;
    }

    try {
      setIsCreatingSheet(true);
      const sheet = await createCentralDatabaseSpreadsheet(
        accessToken,
        'Base de Datos Central - Precios AT&T Premium'
      );
      setSpreadsheetId(sheet.id);
      setSpreadsheetUrl(sheet.url);
      safeSetItem('att_spreadsheet_id', sheet.id);
      safeSetItem('att_spreadsheet_url', sheet.url);

      if (records.length > 0) {
        const dummyReport: SyncExecutionReport = {
          id: `init-${Date.now()}`,
          timestamp: new Date().toISOString(),
          sourceType: 'manual_upload',
          attachmentName: 'Inicialización de Base Central',
          totalRecords: records.length,
          newRecordsCount: records.length,
          priceDropsCount: 0,
          priceIncreasesCount: 0,
          unchangedCount: 0,
          changes: [],
          status: 'success',
          message: 'Base central creada e inicializada en Google Sheets',
          isolatedSheetName: 'Promociones AT&T Premium',
          discardedSheetsCount: 0,
        };
        await syncPricesToGoogleSheet(accessToken, sheet.id, records, dummyReport);
      }

      showToast('Hoja Central de Google Sheets vinculada y guardada permanentemente.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Error creando Google Sheet: ${err.message}`, 'error');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Connect existing Spreadsheet ID
  const handleSetSpreadsheetId = async (id: string) => {
    const cleanId = id.trim();
    if (!cleanId) return;

    if (!accessToken) {
      setSpreadsheetId(cleanId);
      const url = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
      setSpreadsheetUrl(url);
      localStorage.setItem('att_spreadsheet_id', cleanId);
      localStorage.setItem('att_spreadsheet_url', url);
      showToast('ID de hoja guardado permanentemente', 'success');
      return;
    }

    try {
      const meta = await getSpreadsheetMetadata(accessToken, cleanId);
      setSpreadsheetId(meta.id);
      setSpreadsheetUrl(meta.url);
      safeSetItem('att_spreadsheet_id', meta.id);
      safeSetItem('att_spreadsheet_url', meta.url);
      showToast(`Hoja vinculada permanentemente: "${meta.title}"`, 'success');
    } catch (err: any) {
      showToast(`Error al vincular hoja: ${err.message}`, 'error');
    }
  };

  // Set Recipient Email
  const handleSetRecipientEmail = (email: string) => {
    const clean = email.trim();
    if (clean) {
      setRecipientEmail(clean);
      safeSetItem('att_recipient_email', clean);
      showToast(`Destinatario configurado: ${clean}`, 'success');
    }
  };

  // Switch to Quoter with selected record
  const handleSelectForQuotation = (record: DevicePriceRecord) => {
    setSelectedRecordForQuote(record);
    setActiveTab('cotizador');
    showToast(`Cotizando ${record.model} en Plan ${record.planNombre}`, 'info');
  };

  // CORE PROCESSING LOGIC:
  // Isolate "Promociones AT&T Premium", Discard other sheets, Parse Matrix Plans, Update DB & Google Sheets, Send Email
  const processExcelData = async (
    fileBuffer: ArrayBuffer | Uint8Array,
    filename: string,
    emailContext?: { emailId: string; subject: string; sender: string }
  ) => {
    setIsProcessing(true);

    try {
      // 1. EXTRACT: Isolate "Promociones AT&T Premium" sheet and discard all other sheets
      const extraction = extractATTPriceList(fileBuffer, filename);

      if (extraction.records.length === 0) {
        throw new Error('No se pudieron extraer promociones vigentes de la hoja "Promociones AT&T Premium".');
      }

      // Update plans list with exact prices extracted from the row below plan names
      let updatedPlans = plans;
      if (extraction.extractedPlans.length > 0) {
        updatedPlans = loadPlans();
        setPlans(updatedPlans);
      }

      // 2. DIFF: Compare against previous central records
      const diffResult = computePriceDifferences(records, extraction.records);

      // 3. UPDATE CENTRAL DATABASE: Store only records with active valid promotions
      const updatedCentral = deduplicateDeviceRecords(extraction.records);
      setRecords(updatedCentral);

      // 4. PREPARE EXECUTION REPORT
      const report: SyncExecutionReport = {
        id: `report-${Date.now()}`,
        timestamp: new Date().toISOString(),
        sourceType: emailContext ? 'gmail' : 'manual_upload',
        emailSubject: emailContext?.subject,
        emailId: emailContext?.emailId,
        sender: emailContext?.sender,
        attachmentName: filename,
        totalRecords: extraction.records.length,
        newRecordsCount: diffResult.newRecordsCount,
        priceDropsCount: diffResult.priceDropsCount,
        priceIncreasesCount: diffResult.priceIncreasesCount,
        unchangedCount: diffResult.unchangedCount,
        changes: diffResult.changes,
        isolatedSheetName: extraction.targetSheetName,
        discardedSheetsCount: extraction.discardedSheets.length,
        extractedPlansCount: extraction.extractedPlans.length,
        status: 'success',
        message: `Se sincronizaron ${extraction.records.length} promociones vigentes. Hoja procesada: "${extraction.targetSheetName}".`,
      };

      // 5. UPDATE GOOGLE SHEETS (if connected)
      if (accessToken && spreadsheetId) {
        try {
          const sheetUrl = await syncPricesToGoogleSheet(
            accessToken,
            spreadsheetId,
            updatedCentral,
            report
          );
          report.spreadsheetId = spreadsheetId;
          report.spreadsheetUrl = sheetUrl;
        } catch (sheetErr: any) {
          console.error('Error al actualizar Google Sheets:', sheetErr);
          report.message += ` (Google Sheets: ${sheetErr.message})`;
        }
      }

      // 6. SEND EMAIL SUMMARY VIA GMAIL API
      const targetEmail = recipientEmail || user?.email;
      if (accessToken && targetEmail) {
        try {
          report.emailSentTo = targetEmail;
          await sendSyncSummaryEmail(accessToken, targetEmail, report);
          report.emailSentStatus = 'sent';
        } catch (emailErr: any) {
          console.error('Error al enviar correo de resumen:', emailErr);
          report.emailSentStatus = 'failed';
          report.message += ` (Envío correo: ${emailErr.message})`;
        }
      } else {
        report.emailSentStatus = 'not_requested';
      }

      // Save report
      setReports((prev) => [report, ...prev]);
      setLatestReport(report);

      // Sync master state with backend server so all visitors across any device immediately see fresh data
      try {
        fetch('/api/master/update-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: updatedCentral,
            plans: updatedPlans,
            latestReport: report,
            reports: [report, ...reports],
            spreadsheetId,
            spreadsheetUrl: report.spreadsheetUrl || spreadsheetUrl,
          }),
        }).catch((err) => console.warn('Could not sync update to server:', err));
      } catch (e) {}

      // Mark email as processed if from Gmail
      if (emailContext?.emailId) {
        setEmails((prev) =>
          prev.map((m) =>
            m.id === emailContext.emailId
              ? { ...m, processed: true, processedAt: new Date().toISOString() }
              : m
          )
        );
      }

      showToast(
        `¡Tabla vinculada con éxito! ${extraction.records.length} promociones vigentes cargadas. Hoja aislada: "${extraction.targetSheetName}".`,
        'success'
      );
      setActiveTab('cotizador');
    } catch (err: any) {
      console.error('Error en procesamiento:', err);
      showToast(err.message || 'Error al procesar el archivo Excel', 'error');
    } finally {
      setIsProcessing(false);
      setActiveProcessingId(null);
    }
  };

  // Process a detected Gmail message manually
  const handleProcessEmail = async (emailMsg: DetectedEmailMessage) => {
    if (!accessToken) {
      showToast('Inicia sesión para descargar y procesar el adjunto', 'info');
      return;
    }

    const attachment = emailMsg.attachments[0];
    if (!attachment) {
      showToast('El correo no contiene un archivo Excel válido adjunto.', 'error');
      return;
    }

    setActiveProcessingId(emailMsg.id);

    try {
      showToast(`Descargando "${attachment.filename}" desde Gmail...`, 'info');
      const fileBytes = await downloadGmailAttachment(
        accessToken,
        emailMsg.id,
        attachment.id
      );

      await processExcelData(fileBytes, attachment.filename, {
        emailId: emailMsg.id,
        subject: emailMsg.subject,
        sender: emailMsg.sender,
      });
    } catch (err: any) {
      console.error(err);
      showToast(`Error al procesar correo: ${err.message}`, 'error');
      setActiveProcessingId(null);
    }
  };

  // Manual File Upload Handler
  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          if (buffer) {
            await processExcelData(buffer, file.name);
          }
        } catch (err: any) {
          console.error('Upload processing error:', err);
          showToast(err?.message || 'Error al procesar el archivo Excel', 'error');
        }
      };
      reader.onerror = () => {
        showToast('Error al leer el archivo seleccionado', 'error');
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    } catch (err: any) {
      console.error('File selection error:', err);
      showToast(err?.message || 'Error al seleccionar archivo', 'error');
    }
  };

  // Simulate / Generate AT&T Sample file
  const handleSimulateSample = async () => {
    try {
      const { buffer, filename } = createSampleATTExcelBuffer();
      showToast(
        'Simulando recepción de archivo y extrayendo promociones vigentes de "Promociones AT&T Premium"...',
        'info'
      );
      await processExcelData(buffer, filename, {
        emailId: `simulated-${Date.now()}`,
        subject: 'LISTA DE PRECIOS AT&T - PROMOCIONES PREMIUM',
        sender: 'distribucion.precios@att.com.mx',
      });
    } catch (err: any) {
      console.error('Simulation error:', err);
      showToast(err?.message || 'Error al ejecutar simulación', 'error');
    }
  };

  // Resend Summary Email
  const [isResending, setIsResending] = useState(false);
  const handleResendEmail = async () => {
    if (!latestReport || !accessToken) {
      showToast('Inicia sesión para re-enviar el correo.', 'info');
      return;
    }

    const target = recipientEmail || user?.email;
    if (!target) {
      showToast('Ingresa un correo destinatario.', 'error');
      return;
    }

    try {
      setIsResending(true);
      await sendSyncSummaryEmail(accessToken, target, latestReport);
      showToast(`Resumen re-enviado con éxito a ${target}`, 'success');
    } catch (err: any) {
      showToast(`Error al enviar: ${err.message}`, 'error');
    } finally {
      setIsResending(false);
    }
  };

  const masterEmail = 'UserTotix98@gmail.com';
  const isOwner = user?.email?.toLowerCase() === masterEmail.toLowerCase();
  const isTableLinked = records.length > 0 && plans.length > 0;

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-cyan-500 selection:text-white ${
        theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* App Header */}
      <Header
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        isScanning={isScanning}
        onScanNow={() => handleScanGmail(false)}
        hasToken={!!accessToken}
        masterEmail={masterEmail}
        isMasterConnected={isTableLinked}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* Automation Config & Quick Actions Bar */}
      <AutomationConfigBar
        spreadsheetId={spreadsheetId}
        spreadsheetUrl={spreadsheetUrl}
        onSetSpreadsheetId={handleSetSpreadsheetId}
        onCreateSpreadsheet={handleCreateSpreadsheet}
        isCreatingSheet={isCreatingSheet}
        recipientEmail={recipientEmail}
        onSetRecipientEmail={handleSetRecipientEmail}
        isAutoMonitorActive={isAutoMonitorActive}
        onToggleAutoMonitor={() => setIsAutoMonitorActive(!isAutoMonitorActive)}
        onUploadFile={handleManualUpload}
        onGenerateAndRunSample={handleSimulateSample}
        isProcessing={isProcessing}
        hasToken={!!accessToken}
        isOwner={isOwner}
        masterEmail={masterEmail}
        theme={theme}
      />

      {/* Persistent Missing Table Legend Banner (when not linked) */}
      {!isTableLinked && (
        <div className="bg-amber-950/80 border-b border-amber-600/60 px-4 py-3 text-amber-200 text-xs shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
              <span>
                <strong>FALTA VINCULAR TABLA DE PRECIOS:</strong> No se muestran precios de planes ni equipos hasta que se procese el correo <strong>"LISTA DE PRECIOS"</strong> o se suba el archivo Excel.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('inbox')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition shrink-0"
            >
              Vincular Tabla Ahora
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toast && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div
            className={`px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-lg transition-all animate-fadeIn ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-300 border border-rose-800'
                : 'bg-cyan-950/90 text-cyan-300 border border-cyan-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white text-xs ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mobile Drawer Navigation (Slide-over for Responsive Viewports) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div
            className={`fixed inset-y-0 left-0 max-w-xs w-full shadow-2xl p-5 flex flex-col justify-between overflow-y-auto animate-slideInLeft border-r ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b pb-4 border-slate-700/50">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white">
                    <Radio className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm">Menú de Navegación</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`p-1.5 rounded-lg transition ${
                    theme === 'dark' ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Theme Switcher inside Drawer */}
              <div
                className={`p-3 rounded-2xl flex items-center justify-between border ${
                  theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="text-xs">
                  <span className="font-bold block">Tema de la Interfaz</span>
                  <span className={theme === 'dark' ? 'text-slate-400 text-[11px]' : 'text-slate-500 text-[11px]'}>
                    {theme === 'dark' ? 'Modo Oscuro (Dark)' : 'Modo Claro (Light)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center space-x-1"
                >
                  <span>{theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}</span>
                </button>
              </div>

              {/* Group 1: Cotizadores y Ventas */}
              <div className="space-y-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wider block px-1 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  1. Ventas &amp; Cotizadores
                </span>
                <button
                  onClick={() => {
                    setActiveTab('cotizador');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'cotizador'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                      : theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Cotizador WhatsApp</span>
                  </div>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                    Oficial
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('facebook');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'facebook'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow'
                      : theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Megaphone className="w-4 h-4 text-cyan-400" />
                    <span>Publicidad Facebook</span>
                  </div>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800">
                    Imágenes &amp; IA
                  </span>
                </button>
              </div>

              {/* Group 2: Catálogo y Precios */}
              <div className="space-y-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wider block px-1 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  2. Catálogo &amp; Precios
                </span>
                <button
                  onClick={() => {
                    setActiveTab('database');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'database'
                      ? 'bg-cyan-600 text-white shadow'
                      : theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Database className="w-4 h-4" />
                    <span>Promociones Vigentes</span>
                  </div>
                  <span className="text-[10px] opacity-75">
                    {records.length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('planes');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'planes'
                      ? 'bg-cyan-600 text-white shadow'
                      : theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Tag className="w-4 h-4 text-cyan-400" />
                    <span>Tabla de Planes</span>
                  </div>
                  <span className="text-[10px] opacity-75">
                    {plans.length}
                  </span>
                </button>
              </div>

              {/* Group 3: Automatización y Sincronización */}
              <div className="space-y-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wider block px-1 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  3. Automatización
                </span>
                <button
                  onClick={() => {
                    setActiveTab('inbox');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'inbox'
                      ? 'bg-cyan-600 text-white shadow'
                      : theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Mail className="w-4 h-4" />
                    <span>Bandeja Gmail / Carga</span>
                  </div>
                  {emails.length > 0 && (
                    <span className="text-[10px] bg-cyan-900 text-cyan-200 px-1.5 py-0.5 rounded">
                      {emails.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('report');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'report'
                      ? 'bg-cyan-600 text-white shadow'
                      : theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <FileCheck className="w-4 h-4" />
                    <span>Resumen de Cambios</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('history');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'history'
                      ? 'bg-cyan-600 text-white shadow'
                      : theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <History className="w-4 h-4" />
                    <span>Historial</span>
                  </div>
                  <span className="text-[10px] opacity-75">
                    {reports.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className={`pt-4 border-t text-[11px] ${theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'}`}>
              AT&amp;T Precios Sync • Modo Responsivo
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        {/* ========================================================================= */}
        {/* DESKTOP & TABLET ORGANIZED NAVIGATION (MENÚS Y SUBMENÚS)                 */}
        {/* ========================================================================= */}
        <div
          className={`border rounded-2xl p-3 space-y-2.5 shadow-sm ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* LEVEL 1: CATEGORY TABS (MENÚS PRINCIPALES) */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
              {/* Category 1: Ventas & Cotizadores */}
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('ventas');
                  if (activeTab !== 'cotizador' && activeTab !== 'facebook') {
                    setActiveTab('cotizador');
                  }
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeCategory === 'ventas'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <MessageCircle className="w-4 h-4 text-emerald-300" />
                <span>1. Cotizadores &amp; Redes</span>
              </button>

              {/* Category 2: Catálogo & Precios */}
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('catalogo');
                  if (activeTab !== 'database' && activeTab !== 'planes') {
                    setActiveTab('database');
                  }
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeCategory === 'catalogo'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>2. Catálogo &amp; Precios</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeCategory === 'catalogo' ? 'bg-cyan-800 text-white' : 'bg-slate-800 text-slate-300'
                }`}>
                  {records.length}
                </span>
              </button>

              {/* Category 3: Automatización & Sincronización */}
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('automatizacion');
                  if (activeTab !== 'inbox' && activeTab !== 'report' && activeTab !== 'history') {
                    setActiveTab('inbox');
                  }
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeCategory === 'automatizacion'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>3. Automatización</span>
              </button>
            </div>

            {/* Quick status on the right */}
            <div className="hidden md:flex items-center space-x-2 text-xs">
              <span className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Vista activa:
              </span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950 px-2 py-0.5 rounded-lg border border-cyan-300 dark:border-cyan-800 text-[11px]">
                {activeTab === 'cotizador' && '💬 Cotizador WhatsApp'}
                {activeTab === 'facebook' && '📢 Publicidad Facebook'}
                {activeTab === 'database' && '📱 Promociones Vigentes'}
                {activeTab === 'planes' && '🏷️ Tabla de Planes'}
                {activeTab === 'inbox' && '📥 Bandeja Gmail'}
                {activeTab === 'report' && '📊 Resumen de Cambios'}
                {activeTab === 'history' && '🕒 Historial'}
              </span>
            </div>
          </div>

          {/* LEVEL 2: SUBMENUS STRIP (SUBMENÚS ESPECÍFICOS SEGÚN CATEGORÍA) */}
          <div
            className={`pt-2 border-t flex items-center space-x-1.5 overflow-x-auto ${
              theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            {activeCategory === 'ventas' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('cotizador')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'cotizador'
                      ? 'bg-emerald-600 text-white shadow'
                      : theme === 'dark'
                        ? 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Cotizador WhatsApp (Oficial)</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1 rounded border border-emerald-800">
                    Regla de Oro
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('facebook')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'facebook'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow'
                      : theme === 'dark'
                        ? 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Publicidad Facebook (Imágenes 1080p &amp; IA)</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1 rounded border border-cyan-800">
                    Descarga ZIP
                  </span>
                </button>
              </>
            )}

            {activeCategory === 'catalogo' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'database'
                      ? 'bg-cyan-600 text-white shadow'
                      : theme === 'dark'
                        ? 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Promociones Vigentes</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 rounded border border-cyan-800">
                    {records.length} modelos
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('planes')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'planes'
                      ? 'bg-cyan-600 text-white shadow'
                      : theme === 'dark'
                        ? 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Tabla de Planes AT&amp;T Ármalo</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 rounded border border-cyan-800">
                    {plans.length} planes
                  </span>
                </button>
              </>
            )}

            {activeCategory === 'automatizacion' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'inbox'
                      ? 'bg-indigo-600 text-white shadow'
                      : theme === 'dark'
                        ? 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{isOwner ? 'Bandeja Gmail / Subir Excel' : 'Buzón Protegido'}</span>
                  {isOwner && emails.length > 0 && (
                    <span className="text-[10px] bg-cyan-900 text-cyan-200 px-1.5 rounded">
                      {emails.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'report'
                      ? 'bg-indigo-600 text-white shadow'
                      : theme === 'dark'
                        ? 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Resumen de Cambios</span>
                  {latestReport && (
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 rounded border border-emerald-800">
                      {latestReport.priceDropsCount} reducciones
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'history'
                      ? 'bg-indigo-600 text-white shadow'
                      : theme === 'dark'
                        ? 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Historial de Sincronizaciones ({reports.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'cotizador' && (
          <CotizadorWhatsApp
            records={records}
            plans={plans}
            selectedDeviceRecord={selectedRecordForQuote}
            onNavigateToInbox={() => setActiveTab('inbox')}
            onNavigateToPlanes={() => setActiveTab('planes')}
          />
        )}

        {activeTab === 'facebook' && (
          <FacebookAdsGenerator
            records={records}
            plans={plans}
            theme={theme}
            onNavigateToInbox={() => setActiveTab('inbox')}
            onNavigateToQuoter={(rec) => {
              handleSelectForQuotation(rec);
            }}
          />
        )}

        {activeTab === 'database' && (
          <CentralDatabaseTable
            records={records}
            spreadsheetUrl={spreadsheetUrl}
            onForceSyncToSheet={spreadsheetId && accessToken ? handleCreateSpreadsheet : undefined}
            onSelectForQuotation={handleSelectForQuotation}
            onNavigateToInbox={() => setActiveTab('inbox')}
          />
        )}

        {activeTab === 'planes' && (
          <PlansManager
            plans={plans}
            onPlansChange={handlePlansChange}
            onNavigateToInbox={() => setActiveTab('inbox')}
          />
        )}

        {activeTab === 'inbox' && (
          isOwner ? (
            <GmailInboxViewer
              emails={emails}
              isScanning={isScanning}
              isProcessing={isProcessing}
              activeProcessingId={activeProcessingId}
              onScanNow={() => handleScanGmail(false)}
              onProcessEmail={handleProcessEmail}
              hasToken={!!accessToken}
              onSimulateSample={handleSimulateSample}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-4 my-8 shadow-xl animate-fadeIn">
              <div className="w-14 h-14 bg-cyan-950/80 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto border border-cyan-800">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Buzón de Gmail Protegido</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Este sistema está sincronizado de forma continua exclusivamente con el buzón de <strong>{masterEmail}</strong>, garantizando que nadie tenga acceso a los correos personales del administrador.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed pt-1">
                  Todos los miembros del equipo y visitantes pueden utilizar el <strong>Cotizador WhatsApp</strong> y consultar las <strong>Promociones Vigentes</strong> libremente sin necesidad de iniciar sesión.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('cotizador')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow transition"
                >
                  Ir al Cotizador WhatsApp
                </button>
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-medium transition"
                >
                  {isLoggingIn ? 'Verificando...' : 'Acceso Administrador (UserTotix98)'}
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'report' && (
          latestReport ? (
            <SyncReportViewer
              report={latestReport}
              onResendEmail={handleResendEmail}
              isSendingEmail={isResending}
              hasToken={!!accessToken}
              onNavigateToInbox={() => setActiveTab('inbox')}
            />
          ) : (
            <div className="text-center py-16 bg-slate-900/60 rounded-2xl border border-dashed border-slate-800">
              <FileCheck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">Aún no se ha ejecutado ninguna sincronización</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                En cuanto se procese una lista de precios desde Gmail o archivo de prueba, aquí podrás visualizar
                las reducciones de cuotas, nuevos modelos y la vista previa del correo despachado.
              </p>
              <button
                onClick={handleSimulateSample}
                disabled={isProcessing}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
              >
                Simular Lista AT&amp;T de Ejemplo Ahora
              </button>
            </div>
          )
        )}

        {activeTab === 'history' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Historial de Sincronizaciones Ejecutadas ({reports.length})
            </h3>
            {reports.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No hay registros en el historial.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {reports.map((rep) => (
                  <div key={rep.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">
                        {rep.attachmentName} ({rep.sourceType === 'gmail' ? 'Gmail' : 'Carga directa'})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(rep.timestamp).toLocaleString('es-MX')} • Hoja: {rep.isolatedSheetName} (descartadas {rep.discardedSheetsCount} hojas)
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-emerald-400 font-semibold">{rep.priceDropsCount} reducciones</span>
                      <span className="text-cyan-400 font-semibold">{rep.newRecordsCount} nuevos</span>
                      <button
                        onClick={() => {
                          setLatestReport(rep);
                          setActiveTab('report');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 text-[11px]"
                      >
                        Ver Detalle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className={`border-t py-4 text-center text-xs transition-colors ${
          theme === 'dark' ? 'bg-slate-950 border-slate-900 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AT&amp;T Precios Sync • Lector continuo de correo activo • Promociones Vigentes</span>
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
            Conectado a Gmail API y Google Sheets (Persistencia Permanente)
          </span>
        </div>
      </footer>
    </div>
  );
}
