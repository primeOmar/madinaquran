// PaymentModal.jsx
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, X } from 'lucide-react';

export default function PaymentModal({
  isOpen,
  onClose,
  selectedPayment,
  paymentAction,
  rejectionReason,
  setRejectionReason,
  onPaymentAction
}) {
  if (!isOpen || !selectedPayment) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-blue-900/90 border border-blue-700/30 rounded-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xl font-bold mb-4">
            {paymentAction === 'confirm' ? 'Confirm Payment' : 'Reject Payment'}
          </h3>
          
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student</label>
                <p className="text-blue-200">{selectedPayment.student_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <p className="text-blue-200">${selectedPayment.amount}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Transaction Code</label>
              <p className="text-blue-200 font-mono">{selectedPayment.transaction_code}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <p className="text-blue-200 capitalize">{selectedPayment.payment_method}</p>
            </div>
            
            {paymentAction === 'reject' && (
              <div>
                <label className="block text-sm font-medium mb-1">Rejection Reason</label>
                <textarea
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2 rounded-lg bg-blue-800/50 border border-blue-700/30 focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Please provide a reason for rejection"
                />
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-blue-800/50 hover:bg-blue-700/50"
            >
              Cancel
            </button>
            <button
              onClick={onPaymentAction}
              className={`px-4 py-2 rounded-lg ${
                paymentAction === 'confirm' 
                  ? 'bg-green-600 hover:bg-green-500' 
                  : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {paymentAction === 'confirm' ? 'Confirm Payment' : 'Reject Payment'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}