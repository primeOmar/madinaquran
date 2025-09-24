import { useState, useEffect } from 'react';
import { adminApi } from '../lib/supabaseClient';
import { Users, UserPlus, BookOpen, Video } from "lucide-react";


export function useAdminData() {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [videoSessions, setVideoSessions] = useState([]);
  const [feePayments, setFeePayments] = useState([]);
  const [stats, setStats] = useState([
    { label: "Total Teachers", value: "0", icon: Users, change: "+0" },
    { label: "Total Students", value: "0", icon: UserPlus, change: "+0" },
    { label: "Active Classes", value: "0", icon: BookOpen, change: "+0" },
    { label: "Live Sessions", value: "0", icon: Video, change: "+0" },
  ]);
  const [loading, setLoading] = useState({
    teachers: false,
    students: false,
    classes: false,
    live: false,
    fees: false
  });

  const fetchData = async (type) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      switch (type) {
        case 'teachers':
          const teachersData = await adminApi.getTeachers();
          setTeachers(teachersData);
          break;
        case 'students':
          const studentsData = await adminApi.getStudents();
          setStudents(studentsData);
          break;
        case 'classes':
          const classesData = await adminApi.getClasses();
          setClasses(classesData);
          break;
        case 'live':
          const liveData = await adminApi.getVideoSessions();
          setVideoSessions(liveData);
          break;
        case 'fees':
          const feesData = await adminApi.feesManagement.getStudentsWithFees();
          setFeePayments(feesData);
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const refreshData = async (types = ['teachers', 'students', 'classes', 'live', 'fees']) => {
    await Promise.allSettled(types.map(type => fetchData(type)));
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
  setStats([
    { 
      label: "Total Teachers", 
      value: (teachers?.length ?? 0).toString(), 
      icon: Users, 
      change: "+0" 
    },
    { 
      label: "Total Students", 
      value: (students?.length ?? 0).toString(), 
      icon: UserPlus, 
      change: "+0" 
    },
    { 
      label: "Active Classes", 
      value: (classes?.length ?? 0).toString(), 
      icon: BookOpen, 
      change: "+0" 
    },
    { 
      label: "Live Sessions", 
      value: (videoSessions?.length ?? 0).toString(), 
      icon: Video, 
      change: "+0" 
    },
  ]);
}, [teachers, students, classes, videoSessions]);
  return {
    teachers,
    students,
    classes,
    videoSessions,
    feePayments,
    stats,
    loading,
    fetchData,
    refreshData
  };
}
