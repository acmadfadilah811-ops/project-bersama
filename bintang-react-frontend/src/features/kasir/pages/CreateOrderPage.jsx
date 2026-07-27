import { useNavigate } from 'react-router-dom';
import CreateOrderModal from '../components/CreateOrderModal';

export default function CreateOrderPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#F4F7FE]">
      <CreateOrderModal
        isOpen={true}
        onClose={() => navigate('/kasir/terminal')}
        onSuccess={() => navigate('/kasir/antrean-wa')}
      />
    </div>
  );
}
