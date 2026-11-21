import React from 'react';
import { SyllabusExplorer } from '../components/curriculum/SyllabusExplorer';
import type { ExamTrack } from '../types/database';

interface ExamSyllabusPageProps {
  examTrack: ExamTrack;
}

const ExamSyllabusPage: React.FC<ExamSyllabusPageProps> = ({ examTrack }) => {
  return <SyllabusExplorer examTrack={examTrack} />;
};

export default ExamSyllabusPage;
