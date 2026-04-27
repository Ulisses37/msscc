import { useState, useEffect } from 'react';
import { submitVolunteerSignup } from '@/services/volunteerService';

export interface VolunteerSlot {
  volunteer_slot_id: number;
  event: number; // Foreign key ID
  position_name: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  capacity: number;
  filled_count: number;
}

export function VolunteerSignupForm({ event, onClose }: { event: any, onClose: () => void }) {
  const [slots, setSlots] = useState<VolunteerSlot[]>([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    slot: '',
    message: ''
  });
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Fetch slots for this specific event
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/volunteer_slots/?event=${event.id}`)
      .then(res => res.json())
      .then(data => setSlots(data));
  }, [event.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Subtask 337: Validate all fields
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.slot) {
      setStatus({ type: 'error', msg: 'Please fill out all required fields.' });
      return;
    }

    const res = await submitVolunteerSignup(formData);
    if (res.ok) {
      setStatus({ type: 'success', msg: 'Successfully submitted! Thank you for volunteering.' });
      setTimeout(onClose, 3000);
    } else {
      setStatus({ type: 'error', msg: 'Submission failed. Please try again.' });
    }
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', padding: 'var(--space-8)', maxWidth: '500px', width: '100%', borderRadius: '8px' }}>
        <h3>Sign up for {event.title}</h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <input type="text" placeholder="First Name" onChange={e => setFormData({...formData, first_name: e.target.value})} required />
          <input type="text" placeholder="Last Name" onChange={e => setFormData({...formData, last_name: e.target.value})} required />
          <input type="email" placeholder="Email" onChange={e => setFormData({...formData, email: e.target.value})} required />
          
          {/* Subtask 336/337: Multiple shifts/time frames */}
          <select onChange={e => setFormData({...formData, slot: e.target.value})} required>
            <option value="">Select a Shift</option>
            {slots.map(slot => (
              <option 
                key={slot.volunteer_slot_id} 
                value={slot.volunteer_slot_id}
                disabled={slot.filled_count >= slot.capacity} // Subtask 337: Disable if full
              >
                {slot.position_name} ({new Date(slot.start_datetime).toLocaleTimeString()} - {slot.capacity - slot.filled_count} left)
              </option>
            ))}
          </select>

          <textarea placeholder="Comments" onChange={e => setFormData({...formData, message: e.target.value})} />
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" style={{ backgroundColor: '#dc2626', color: 'white', padding: '10px' }}>Submit</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>

        {status && (
          <p style={{ color: status.type === 'success' ? 'green' : 'red', marginTop: '15px' }}>
            {status.msg}
          </p>
        )}
      </div>
    </div>
  );
  
}