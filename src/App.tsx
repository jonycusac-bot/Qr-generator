import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header, TabType } from './components/Header';
import { ProjectList } from './components/ProjectList';
import { ProjectForm } from './components/ProjectForm';
import { AnalyticsView } from './components/AnalyticsView';
import { UserManagementView } from './components/UserManagementView';
import { OneDriveQuickModal } from './components/OneDriveQuickModal';
import { QRStickerModal } from './components/QRStickerModal';
import { ScanSimulatorModal } from './components/ScanSimulatorModal';
import { ConfirmModal } from './components/ConfirmModal';
import { QRProject } from './types';
import {
  FolderSync,
  QrCode,
  ShieldCheck,
  RotateCcw,
  Building2,
  HeartHandshake,
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { resetDemo } = useApp();

  const [currentTab, setCurrentTab] = useState<TabType>('projects');
  const [editingProject, setEditingProject] = useState<QRProject | null>(null);

  // Modals
  const [quickOneDriveProject, setQuickOneDriveProject] = useState<QRProject | null>(null);
  const [isQuickOneDriveOpen, setIsQuickOneDriveOpen] = useState(false);

  const [stickerProject, setStickerProject] = useState<QRProject | null>(null);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);

  const [simulatorProject, setSimulatorProject] = useState<QRProject | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleNewProject = () => {
    setEditingProject(null);
    setCurrentTab('new-project');
  };

  const handleEditProject = (project: QRProject) => {
    setEditingProject(project);
    setCurrentTab('new-project');
  };

  const handleOpenQuickOneDrive = (project: QRProject) => {
    setQuickOneDriveProject(project);
    setIsQuickOneDriveOpen(true);
  };

  const handleOpenSticker = (project: QRProject) => {
    setStickerProject(project);
    setIsStickerModalOpen(true);
  };

  const handleOpenSimulator = (project: QRProject) => {
    setSimulatorProject(project);
    setIsSimulatorOpen(true);
  };

  const handleSavedProject = (project: QRProject) => {
    setCurrentTab('projects');
    setEditingProject(null);
    // Show sticker modal for the newly created or updated project
    setStickerProject(project);
    setIsStickerModalOpen(true);
  };

  const handleResetDemo = () => {
    setIsResetConfirmOpen(true);
  };

  const confirmResetDemo = async () => {
    setIsResetConfirmOpen(false);
    await resetDemo();
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'simulator') {
            setIsSimulatorOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        onNewProjectClick={handleNewProject}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'projects' && (
          <ProjectList
            onNewProject={handleNewProject}
            onEditProject={handleEditProject}
            onOpenQuickOneDrive={handleOpenQuickOneDrive}
            onOpenQRSticker={handleOpenSticker}
            onOpenSimulator={handleOpenSimulator}
          />
        )}

        {currentTab === 'new-project' && (
          <ProjectForm
            initialProject={editingProject}
            onCancel={() => {
              setEditingProject(null);
              setCurrentTab('projects');
            }}
            onSaved={handleSavedProject}
          />
        )}

        {currentTab === 'analytics' && <AnalyticsView />}

        {currentTab === 'users' && <UserManagementView />}
      </main>

      {/* Global Modals */}
      <OneDriveQuickModal
        project={quickOneDriveProject}
        isOpen={isQuickOneDriveOpen}
        onClose={() => {
          setIsQuickOneDriveOpen(false);
          setQuickOneDriveProject(null);
        }}
      />

      <QRStickerModal
        project={stickerProject}
        isOpen={isStickerModalOpen}
        onClose={() => {
          setIsStickerModalOpen(false);
          setStickerProject(null);
        }}
      />

      <ScanSimulatorModal
        initialProject={simulatorProject}
        isOpen={isSimulatorOpen}
        onClose={() => {
          setIsSimulatorOpen(false);
          setSimulatorProject(null);
        }}
      />

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Restaurar Datos de Demostración"
        message="¿Deseas restaurar las instalaciones de muestra iniciales? Los cambios no guardados se sustituirán por los datos de muestra."
        confirmText="Restaurar Datos"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={confirmResetDemo}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
              QR
            </div>
            <span>
              <strong>QR Dinámico</strong> • Sistema de Instalaciones y Enlaces OneDrive
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Restaurar datos de ejemplo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Datos de Demostración</span>
            </button>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Acceso al panel sin contraseña
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

