import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux';
import { store } from './store/store';
import AppRoutes from './routes/AppRoutes'

const App = () => {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          <AppRoutes />
        </div>
      </BrowserRouter>
    </Provider>
  )
}

export default App
