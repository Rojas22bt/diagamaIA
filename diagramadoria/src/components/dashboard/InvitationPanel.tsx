import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';
import {
  Send as SendIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import type { RootState } from '../../store/store';
import {
  sendInvitation,
  fetchReceivedInvitations,
  fetchSentInvitations,
  respondToInvitation,
  cancelInvitation,
  fetchPermissions
} from '../../store/invitationSlice';
import { fetchProjectById } from '../../store/projectSlice';
import type { SendInvitationData, Invitation, Permission } from '../../api/invitationApi';

interface SendInvitationDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  permissions: Permission[];
}

const SendInvitationDialog: React.FC<SendInvitationDialogProps> = ({
  open,
  onClose,
  projectId,
  permissions
}) => {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    toUserEmail: '',
    permissionId: '',
    mensaje: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invitationData: SendInvitationData = {
      projectId,
      toUserEmail: formData.toUserEmail,
      permissionId: Number(formData.permissionId),
      mensaje: formData.mensaje || undefined
    };
    
    dispatch(sendInvitation(invitationData) as any);
    setFormData({ toUserEmail: '', permissionId: '', mensaje: '' });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Enviar Invitación</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email del colaborador"
            type="email"
            fullWidth
            variant="outlined"
            value={formData.toUserEmail}
            onChange={(e) => setFormData({ ...formData, toUserEmail: e.target.value })}
            required
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Nivel de permiso</InputLabel>
            <Select
              value={formData.permissionId}
              label="Nivel de permiso"
              onChange={(e) => setFormData({ ...formData, permissionId: e.target.value })}
              required
            >
              {permissions.map((permission) => (
                <MenuItem key={permission.id} value={permission.id}>
                  {permission.nombre} - {permission.descripcion}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            margin="dense"
            label="Mensaje (opcional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.mensaje}
            onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" startIcon={<SendIcon />}>
            Enviar Invitación
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

interface InvitationCardProps {
  invitation: Invitation;
  type: 'received' | 'sent';
  onRespond?: (invitationId: number, response: 'aceptada' | 'rechazada') => void;
  onCancel?: (invitationId: number) => void;
}

const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  type,
  onRespond,
  onCancel
}) => {
  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'warning';
      case 'aceptada': return 'success';
      case 'rechazada': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'pendiente': return <ScheduleIcon />;
      case 'aceptada': return <CheckIcon />;
      case 'rechazada': return <CloseIcon />;
      default: return null;
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h6" component="h3">
            {invitation.proyecto?.name}
          </Typography>
          <Chip
            icon={getStatusIcon(invitation.estado) || undefined}
            label={invitation.estado.charAt(0).toUpperCase() + invitation.estado.slice(1)}
            color={getStatusColor(invitation.estado) as any}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {invitation.proyecto?.description || 'Sin descripción'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <EmailIcon fontSize="small" color="action" />
          <Typography variant="body2">
            {type === 'received' ? (
              <>De: {invitation.from_user?.name} ({invitation.from_user?.email})</>
            ) : (
              <>Para: {invitation.to_user?.name} ({invitation.to_user?.email})</>
            )}
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Permiso: {invitation.permission?.nombre}
        </Typography>

        {invitation.mensaje && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" fontStyle="italic">
              "{invitation.mensaje}"
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          Enviado: {new Date(invitation.created_at).toLocaleString()}
        </Typography>
      </CardContent>

      {invitation.estado === 'pendiente' && (
        <CardActions>
          {type === 'received' && onRespond && (
            <>
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<CheckIcon />}
                onClick={() => onRespond(invitation.id, 'aceptada')}
              >
                Aceptar
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<CloseIcon />}
                onClick={() => onRespond(invitation.id, 'rechazada')}
              >
                Rechazar
              </Button>
            </>
          )}
          
          {type === 'sent' && onCancel && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => onCancel(invitation.id)}
            >
              Cancelar
            </Button>
          )}
        </CardActions>
      )}
    </Card>
  );
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const InvitationPanel: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useDispatch();
  const rawInvitesState = useSelector((state: RootState) => state.invitations);
  const receivedInvitations = Array.isArray(rawInvitesState.receivedInvitations)
    ? rawInvitesState.receivedInvitations
    : [];
  const sentInvitations = Array.isArray(rawInvitesState.sentInvitations)
    ? rawInvitesState.sentInvitations
    : [];
  const permissions = Array.isArray(rawInvitesState.permissions)
    ? rawInvitesState.permissions
    : [];
  const loading = !!rawInvitesState.loading;
  const error = rawInvitesState.error;
  const { currentProject } = useSelector((state: RootState) => state.projects);
  const { user } = useSelector((state: RootState) => state.auth);

  const [tabValue, setTabValue] = useState(0);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchReceivedInvitations() as any);
    dispatch(fetchSentInvitations() as any);
    dispatch(fetchPermissions() as any);
    
    if (projectId) {
      dispatch(fetchProjectById(Number(projectId)) as any);
    }
  }, [dispatch, projectId]);

  const handleRespondToInvitation = (invitationId: number, response: 'aceptada' | 'rechazada') => {
    dispatch(respondToInvitation({ invitationId, response }) as any);
  };

  const handleCancelInvitation = (invitationId: number) => {
    dispatch(cancelInvitation(invitationId) as any);
  };

  const isProjectCreator = currentProject && user && currentProject.creator_id === user.id;
  const projectInvitations = (Array.isArray(sentInvitations) ? sentInvitations : []).filter(
    (inv) => inv.project_id === Number(projectId)
  );

  if (loading && receivedInvitations.length === 0 && sentInvitations.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {projectId ? 'Gestionar Colaboradores' : 'Mis Invitaciones'}
        </Typography>
        {projectId && isProjectCreator && (
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => setSendDialogOpen(true)}
          >
            Enviar Invitación
          </Button>
        )}
      </Box>

      {projectId && currentProject && (
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Proyecto: {currentProject.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentProject.description}
            </Typography>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label={`Recibidas (${receivedInvitations.length})`} />
          <Tab label={`Enviadas (${projectId ? projectInvitations.length : sentInvitations.length})`} />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {receivedInvitations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No tienes invitaciones pendientes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cuando alguien te invite a colaborar en un proyecto, aparecerá aquí
            </Typography>
          </Box>
        ) : (
          receivedInvitations.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              type="received"
              onRespond={handleRespondToInvitation}
            />
          ))
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {(projectId ? projectInvitations : sentInvitations).length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No has enviado invitaciones
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {projectId ? 'Invita colaboradores a este proyecto' : 'Las invitaciones que envíes aparecerán aquí'}
            </Typography>
          </Box>
        ) : (
          (projectId ? projectInvitations : sentInvitations).map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              type="sent"
              onCancel={handleCancelInvitation}
            />
          ))
        )}
      </TabPanel>

      {projectId && (
        <SendInvitationDialog
          open={sendDialogOpen}
          onClose={() => setSendDialogOpen(false)}
          projectId={Number(projectId)}
          permissions={permissions}
        />
      )}
    </Box>
  );
};

export default InvitationPanel;