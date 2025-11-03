import React, { useEffect, useMemo, useState } from 'react';
 
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
  CircularProgress,
  InputAdornment,
  Stack,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  IconButton
} from '@mui/material';
import { Add as AddIcon, DeleteOutline as DeleteIcon, Search as SearchIcon, Sort as SortIcon, Autorenew as AutorenewIcon } from '@mui/icons-material';
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
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_desc' | 'name_asc'>('created_desc');

  useEffect(() => {
    if (user) {
      dispatch(getUserProjects() as any);
    }
  }, [dispatch, user]);

  const { mine, shared } = useMemo(() => {
    const list = projects || [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(p => (p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)))
      : list;
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    const mine = sorted.filter(p => user && p.creator_id === user.id);
    const shared = sorted.filter(p => !user || p.creator_id !== user.id);
    return { mine, shared };
  }, [projects, query, sortBy, user]);

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
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%)' }}>
      <Navbar />
      <Box sx={{ pt: 8, px: { xs: 2, md: 4 }, pb: 4, maxWidth: 1300, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>📋 Proyectos UML</Typography>
            <Typography variant="subtitle1" color="text.secondary">Crea y gestiona tus diagramas de clases UML, colabora y genera backend/frontend automáticamente.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              placeholder="Buscar proyectos..."
              size="medium"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{ startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )}}
              sx={{ minWidth: { xs: '100%', sm: 280 } }}
            />
            <FormControl sx={{ minWidth: 200 }} size="medium">
              <InputLabel id="sort-by-label">Ordenar por</InputLabel>
              <Select
                labelId="sort-by-label"
                label="Ordenar por"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                startAdornment={<InputAdornment position="start"><SortIcon /></InputAdornment>}
              >
                <MenuItem value={'created_desc'}>Más recientes</MenuItem>
                <MenuItem value={'name_asc'}>Nombre (A-Z)</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refrescar">
              <span>
                <IconButton color="primary" onClick={() => dispatch(getUserProjects() as any)}>
                  <AutorenewIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>Nuevo Proyecto</Button>
          </Stack>
        </Stack>

        {error && (<Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>)}

        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>Mis proyectos</Typography>
            <Chip label={mine.length} size="small" />
          </Stack>
          {mine.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
              <Typography variant="body1" color="text.secondary">No tienes proyectos propios aún.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
              {mine.map((project: Project) => (
                <Card key={`mine-${project.id}`} sx={{ height: '220px', display: 'flex', flexDirection: 'column', borderRadius: 3, border: '1px solid', borderColor: 'divider', background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)', '&:hover': { boxShadow: 8, transform: 'translateY(-2px)', transition: 'all 0.2s ease' } }} onClick={() => handleOpenProject(project.id)}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Typography variant="h6" component="h2" gutterBottom noWrap fontWeight={700}>{project.name}</Typography>
                      <Chip size="small" label="Propietario" color="primary" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{project.description || 'Sin descripción'}</Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">Creado: {new Date(project.created_at).toLocaleDateString()}</Typography>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); handleOpenProject(project.id); }}>Abrir diagrama</Button>
                    <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); navigate(`/generate/${project.id}`); }}>Backend</Button>
                    <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); navigate(`/generate-frontend/${project.id}`); }}>Flutter</Button>
                    <Button size="small" color="error" variant="outlined" onClick={(e) => { e.stopPropagation(); askDeleteProject(project); }} startIcon={<DeleteIcon />} sx={{ ml: 'auto' }}>Eliminar</Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}
        </Box>

        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>Compartidos conmigo</Typography>
            <Chip label={shared.length} size="small" />
          </Stack>
          {shared.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
              <Typography variant="body1" color="text.secondary">Aún no tienes proyectos compartidos.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
              {shared.map((project: Project) => (
                <Card key={`shared-${project.id}`} sx={{ height: '220px', display: 'flex', flexDirection: 'column', borderRadius: 3, border: '1px solid', borderColor: 'divider', background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)', '&:hover': { boxShadow: 8, transform: 'translateY(-2px)', transition: 'all 0.2s ease' } }} onClick={() => handleOpenProject(project.id)}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Typography variant="h6" component="h2" gutterBottom noWrap fontWeight={700}>{project.name}</Typography>
                      <Chip size="small" label="Compartido" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{project.description || 'Sin descripción'}</Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">Creado: {new Date(project.created_at).toLocaleDateString()}</Typography>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); handleOpenProject(project.id); }}>Abrir diagrama</Button>
                    <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); navigate(`/generate/${project.id}`); }}>Backend</Button>
                    <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); navigate(`/generate-frontend/${project.id}`); }}>Flutter</Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}
        </Box>

        {projects.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>No tienes proyectos aún</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Crea tu primer proyecto UML para comenzar</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>Crear proyecto</Button>
          </Box>
        )}

        <Fab color="primary" aria-label="add" sx={{ position: 'fixed', bottom: 24, right: 24 }} onClick={() => setOpenDialog(true)}>
          <AddIcon />
        </Fab>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>🚀 Crear Nuevo Proyecto UML</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Nombre del proyecto" fullWidth variant="outlined" value={projectName} onChange={(e) => setProjectName(e.target.value)} sx={{ mb: 2 }} />
            <TextField margin="dense" label="Descripción (opcional)" fullWidth multiline rows={3} variant="outlined" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateProject} variant="contained" disabled={!projectName.trim() || creating}>{creating ? <CircularProgress size={20} /> : 'Crear Proyecto'}</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteDialogOpen} onClose={() => (!deleting ? setDeleteDialogOpen(false) : null)} maxWidth="xs" fullWidth>
          <DialogTitle>Eliminar proyecto</DialogTitle>
          <DialogContent>
            {deleteError && (<Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>)}
            <Typography>¿Seguro que deseas eliminar el proyecto{projectToDelete ? ` "${projectToDelete.name}"` : ''}? Esta acción no se puede deshacer.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button onClick={handleDeleteProject} color="error" variant="contained" disabled={deleting}>{deleting ? <CircularProgress size={20} /> : 'Eliminar'}</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default ProjectDashboard;