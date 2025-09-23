import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material';
import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import Navbar from '../components/navbar/Navbar';
import { createProject, getUserProjects, deleteProject } from '../store/userSlice';
import type { RootState } from '../store/store';
import type { Project } from '../api/projectApi';

const ProjectDashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { projects, loading, error } = useSelector((state: RootState) => state.user);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      dispatch(getUserProjects() as any);
    }
  }, [dispatch, user]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    
    setCreating(true);
    try {
      const resultAction = await dispatch(createProject({
        titulo: projectName,
        descripcion: projectDescription
      }) as any);
      
      if (createProject.fulfilled.match(resultAction)) {
        setOpenDialog(false);
        setProjectName('');
        setProjectDescription('');
        // Refresh projects list
        dispatch(getUserProjects() as any);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenProject = (projectId: number) => {
    navigate(`/diagram/${projectId}`);
  };

  const askDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const resultAction = await dispatch(deleteProject(projectToDelete.id) as any);
      if (deleteProject.fulfilled.match(resultAction)) {
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
      } else if (deleteProject.rejected.match(resultAction)) {
        setDeleteError(resultAction.error?.message || 'No se pudo eliminar el proyecto');
      }
    } catch (e: any) {
      setDeleteError(e?.message || 'No se pudo eliminar el proyecto');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />
      
      <Box sx={{ pt: 8, px: 3, pb: 3 }}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            📋 Mis Proyectos UML
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Crea y gestiona tus diagramas de clases UML colaborativos
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
          {projects.map((project: Project) => (
            <Card 
              key={project.id}
              sx={{ 
                height: '200px',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out'
                }
              }}
              onClick={() => handleOpenProject(project.id)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="h2" gutterBottom>
                  {project.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {project.description || 'Sin descripción'}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 2 }}>
                  Creado: {new Date(project.created_at).toLocaleDateString()}
                </Typography>
              </CardContent>
              <CardActions>
                <Button 
                  size="small" 
                  variant="contained" 
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenProject(project.id);
                  }}
                >
                  🎨 Abrir Diagrama UML
                </Button>
                {user && user.id === project.creator_id && (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={(e) => {
                      e.stopPropagation();
                      askDeleteProject(project);
                    }}
                    startIcon={<DeleteIcon />}
                    sx={{ ml: 1, whiteSpace: 'nowrap' }}
                  >
                    Eliminar
                  </Button>
                )}
              </CardActions>
            </Card>
          ))}
          
          {projects.length === 0 && !loading && (
            <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No tienes proyectos aún
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Crea tu primer proyecto UML para comenzar
              </Typography>
            </Box>
          )}
        </Box>

        {/* Floating Action Button */}
        <Fab
          color="primary"
          aria-label="add"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
          onClick={() => setOpenDialog(true)}
        >
          <AddIcon />
        </Fab>

        {/* Create Project Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={() => setOpenDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>🚀 Crear Nuevo Proyecto UML</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Nombre del proyecto"
              fullWidth
              variant="outlined"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Descripción (opcional)"
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateProject}
              variant="contained"
              disabled={!projectName.trim() || creating}
            >
              {creating ? <CircularProgress size={20} /> : 'Crear Proyecto'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Project Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => (!deleting ? setDeleteDialogOpen(false) : null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Eliminar proyecto</DialogTitle>
          <DialogContent>
            {deleteError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {deleteError}
              </Alert>
            )}
            <Typography>
              ¿Seguro que deseas eliminar el proyecto
              {projectToDelete ? ` "${projectToDelete.name}"` : ''}? Esta acción no se puede deshacer.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteProject}
              color="error"
              variant="contained"
              disabled={deleting}
            >
              {deleting ? <CircularProgress size={20} /> : 'Eliminar'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default ProjectDashboard;