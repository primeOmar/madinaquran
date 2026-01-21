
import { useState } from 'react';
import { CreditCard, CheckCircle, Clock, FileText, X } from "lucide-react";
import StatCard from '../shared/StatCard';
import PaymentModal from '../../modals/PaymentModal';

export default function FeesSection({ data, loading, onRefresh, onError }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentAction, setPaymentAction] = useState('confirm');

  const { feePayments = [] } = data;
  
  // Calculate stats from feePayments data
  const stats = {
    totalPaid: feePayments.reduce((sum, student) => {
      const confirmedPayments = student.fee_payments?.filter(p => p.status === 'confirmed') || [];
      return sum + confirmedPayments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
    }, 0),
    confirmedPayments: feePayments.reduce((sum, student) => {
      return sum + (student.fee_payments?.filter(p => p.status === 'confirmed').length || 0);
    }, 0),
    pendingPayments: feePayments.reduce((sum, student) => {
      return sum + (student.fee_payments?.filter(p => p.status === 'pending').length || 0);
    }, 0),
    totalPayments: feePayments.reduce((sum, student) => {
      return sum + (student.fee_payments?.length || 0);
    }, 0)
  };

  return (
    <div>
      <h3 className="text-2xl font-semibold flex items-center mb-6">
        <CreditCard className="mr-2" size={24} />
        Fees Management
      </h3>
      
      {/* Fees Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Collected"
          value={`$${stats.totalPaid}`}
          icon={CreditCard}
          color="green"
        />
        <StatCard
          title="Confirmed Payments"
          value={stats.confirmedPayments}
          icon={CheckCircle}
          color="blue"
        />
        <StatCard
          title="Pending Payments"
          value={stats.pendingPayments}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Total Transactions"
          value={stats.totalPayments}
          icon={FileText}
          color="purple"
        />
      </div>

      {/* Students and Payments List */}
      <div className="bg-blue-700/30 rounded-xl p-6 border border-blue-600/30">
        <h4 className="font-bold text-lg mb-4">Student Payments</h4>
        
        {feePayments.length > 0 ? (
          <div className="space-y-4">
            {feePayments.map((student) => (
              <StudentPaymentCard
                key={student.id}
                student={student}
                onPaymentAction={(payment, action) => {
                  setSelectedPayment({
                    ...payment,
                    student_name: student.name
                  });
                  setPaymentAction(action);
                  setShowPaymentModal(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard size={48} className="mx-auto text-blue-400 mb-3" />
            <p className="text-blue-200">No payment records found</p>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        selectedPayment={selectedPayment}
        paymentAction={paymentAction}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={() => {
          setShowPaymentModal(false);
          onRefresh(['fees']);
        }}
      />
    </div>
  );
}

function StudentPaymentCard({ student, onPaymentAction }) {
  return (
    <div className="p-4 rounded-lg bg-blue-800/30 border border-blue-600/30">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h5 className="font-semibold text-lg">{student.name}</h5>
          <p className="text-blue-300 text-sm">
            {student.email} • {student.course} • 
            {student.teacher ? ` Teacher: ${student.teacher.name}` : ' Not assigned'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          student.fee_payments && student.fee_payments.length > 0
            ? 'bg-green-900/50 text-green-300'
            : 'bg-red-900/50 text-red-300'
        }`}>
          {student.fee_payments && student.fee_payments.length > 0
            ? 'Has Payments'
            : 'No Payments'
          }
        </span>
      </div>
      
      {student.fee_payments && student.fee_payments.length > 0 ? (
        <div className="space-y-2">
          {student.fee_payments.map((payment) => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              onAction={onPaymentAction}
            />
          ))}
        </div>
      ) : (
        <p className="text-blue-400 text-sm">No payment records found</p>
      )}
    </div>
  );
}

function PaymentRow({ payment, onAction }) {
  return (
    <div className="flex justify-between items-center p-2 bg-blue-900/20 rounded">
      <div>
        <p className="font-medium">${payment.amount}</p>
        <p className="text-sm text-blue-300">
          {payment.transaction_code} • 
          {new Date(payment.payment_date).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <span className={`px-2 py-1 rounded-full text-xs ${
          payment.status === 'confirmed'
            ? 'bg-green-900/50 text-green-300'
            : payment.status === 'rejected'
            ? 'bg-red-900/50 text-red-300'
            : 'bg-yellow-900/50 text-yellow-300'
        }`}>
          {payment.status}
        </span>
        {payment.status === 'pending' && (
          <div className="flex space-x-1">
            <button
              onClick={() => onAction(payment, 'confirm')}
              className="p-1 rounded bg-green-600 hover:bg-green-500"
            >
              <CheckCircle size={14} />
            </button>
            <button
              onClick={() => onAction(payment, 'reject')}
              className="p-1 rounded bg-red-600 hover:bg-red-500"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}