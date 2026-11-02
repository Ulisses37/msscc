/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { requestDeepLTranslation } from '@/services/deeplService';

import { MemberPopUp } from './BoardOfDirectorCards';
import type { BoardMember } from './page';

const NOTICE_TEXT = '⚠ The English text was changed. Please review the Japanese text.';

jest.mock('@/services/deeplService', () => ({
  requestDeepLTranslation: jest.fn(),
}));

const BOARD_MEMBER: BoardMember = {
  boardMemberId: 12,
  boardMemberNameEn: 'Aiko Smith',
  boardMemberNameJa: '',
  boardMemberImageURL: null,
  boardMemberRoleEn: 'President',
  boardMemberRoleJa: '',
  boardMemberCaptionEn: 'Leads the organization.',
  boardMemberCaptionJa: '',
};

const NEW_OFFICER: BoardMember = {
  boardMemberId: -1,
  boardMemberNameEn: '',
  boardMemberNameJa: '',
  boardMemberImageURL: null,
  boardMemberRoleEn: '',
  boardMemberRoleJa: '',
  boardMemberCaptionEn: '',
  boardMemberCaptionJa: '',
};

describe('MemberPopUp translation buttons', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('translates each board-member field and keeps the values in the draft', async () => {
    // Distinct values prove the popup updates the draft field that initiated each request.
    jest.mocked(requestDeepLTranslation)
      .mockResolvedValueOnce('アイコ・スミス')
      .mockResolvedValueOnce('会長')
      .mockResolvedValueOnce('組織を率いています。');
    const onUpdate = jest.fn();
    const user = userEvent.setup();

    render(
      <MemberPopUp
        member={BOARD_MEMBER}
        type="officer"
        onUpdate={onUpdate}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Translate board member name to Japanese' }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Name (Japanese)')).toHaveValue('アイコ・スミス');
    });

    await user.click(
      screen.getByRole('button', { name: 'Translate board member role to Japanese' }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Role (Japanese)')).toHaveValue('会長');
    });

    await user.click(
      screen.getByRole('button', { name: 'Translate board member caption to Japanese' }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Caption (Japanese)')).toHaveValue('組織を率いています。');
    });

    expect(requestDeepLTranslation).toHaveBeenNthCalledWith(1, 'Aiko Smith');
    expect(requestDeepLTranslation).toHaveBeenNthCalledWith(2, 'President');
    expect(requestDeepLTranslation).toHaveBeenNthCalledWith(3, 'Leads the organization.');

    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onUpdate).toHaveBeenCalledWith(
      {
        ...BOARD_MEMBER,
        boardMemberNameJa: 'アイコ・スミス',
        boardMemberRoleJa: '会長',
        boardMemberCaptionJa: '組織を率いています。',
      },
      null,
    );
    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
  });

  it('shows a per-field notice after manual English edits without changing Japanese text', async () => {
    const user = userEvent.setup();

    render(
      <MemberPopUp
        member={{ ...BOARD_MEMBER, boardMemberNameJa: 'アイコ・スミス' }}
        type="officer"
        onUpdate={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Name (English)'), ' Jr.');
    expect(screen.getAllByText(NOTICE_TEXT)).toHaveLength(1);
    const nameNotice = screen.getByRole('status');
    expect(nameNotice.compareDocumentPosition(screen.getByLabelText('Name (English)'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(nameNotice.compareDocumentPosition(screen.getByLabelText('Name (Japanese)'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await user.click(
      screen.getByRole('button', { name: 'Dismiss English text change notice' }),
    );
    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name (Japanese)')).toHaveValue('アイコ・スミス');

    await user.clear(screen.getByLabelText('Name (English)'));
    expect(screen.getAllByText(NOTICE_TEXT)).toHaveLength(1);

    await user.type(screen.getByLabelText('Role (English)'), ' and Chair');
    expect(screen.getAllByText(NOTICE_TEXT)).toHaveLength(2);
  });

  it('does not show a notice when an English field loses focus without a change', async () => {
    const user = userEvent.setup();

    render(
      <MemberPopUp
        member={BOARD_MEMBER}
        type="officer"
        onUpdate={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Name (English)'));
    await user.tab();

    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
  });

  it('submits a new officer draft without offering a delete action', async () => {
    const onUpdate = jest.fn();
    const user = userEvent.setup();

    render(
      <MemberPopUp
        member={NEW_OFFICER}
        type="officer"
        onUpdate={onUpdate}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Name (English)'), 'New Officer');
    await user.type(screen.getByLabelText('Role (English)'), 'Secretary');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onUpdate).toHaveBeenCalledWith(
      {
        ...NEW_OFFICER,
        boardMemberNameEn: 'New Officer',
        boardMemberRoleEn: 'Secretary',
      },
      null,
    );
  });
});
