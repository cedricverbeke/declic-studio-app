import { useRoute } from '@/lib/router';
import { AdminApp } from '@/components/admin/AdminApp';
import { ClientGallery, ConfirmationScreen } from '@/components/client/ClientGallery';

function App() {
  const route = useRoute();

  if (route.name === 'gallery') {
    return <ClientGallery code={route.code} />;
  }

  if (route.name === 'confirmation') {
    return <ConfirmationScreen orderId={route.orderId} />;
  }

  return <AdminApp />;
}

export default App;
