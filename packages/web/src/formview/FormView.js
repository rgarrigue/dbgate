// @ts-nocheck

import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import ColumnLabel from '../datagrid/ColumnLabel';
import { findForeignKeyForColumn } from 'dbgate-tools';
import styled from 'styled-components';
import useTheme from '../theme/useTheme';
import useDimensions from '../utility/useDimensions';
import FormViewToolbar from './FormViewToolbar';
import { useShowMenu } from '../modals/showMenu';
import FormViewContextMenu from './FormViewContextMenu';
import keycodes from '../utility/keycodes';
import { CellFormattedValue } from '../datagrid/DataGridRow';
import { cellFromEvent } from '../datagrid/selection';
import InplaceEditor from '../datagrid/InplaceEditor';

const Table = styled.table`
  border-collapse: collapse;
  outline: none;
`;

const Wrapper = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  display: flex;
  overflow-x: scroll;
`;

const TableRow = styled.tr`
  background-color: ${(props) => props.theme.gridbody_background};
  &:nth-child(6n + 3) {
    background-color: ${(props) => props.theme.gridbody_background_alt2};
  }
  &:nth-child(6n + 6) {
    background-color: ${(props) => props.theme.gridbody_background_alt3};
  }
`;

const TableHeaderCell = styled.td`
  border: 1px solid ${(props) => props.theme.border};
  text-align: left;
  padding: 2px;
  background-color: ${(props) => props.theme.gridheader_background};
  overflow: hidden;
  position: relative;

  ${(props) =>
    props.isSelected &&
    `
    background: initial;
    background-color: ${props.theme.gridbody_selection[4]};
    color: ${props.theme.gridbody_invfont1};`}
`;

const TableBodyCell = styled.td`
  font-weight: normal;
  border: 1px solid ${(props) => props.theme.border};
  // border-collapse: collapse;
  padding: 2px;
  white-space: nowrap;
  position: relative;
  overflow: hidden;

  ${(props) =>
    props.isSelected &&
    `
    background: initial;
    background-color: ${props.theme.gridbody_selection[4]};
    color: ${props.theme.gridbody_invfont1};`}

  ${(props) =>
    !props.isSelected &&
    props.isModifiedCell &&
    `
        background-color: ${props.theme.gridbody_background_orange[1]};`}
`;

const FocusField = styled.input`
  // visibility: hidden
  position: absolute;
  left: -1000px;
  top: -1000px;
`;

function isDataCell(cell) {
  return cell[1] % 2 == 1;
}

export default function FormView(props) {
  const { toolbarPortalRef, tabVisible, config, setConfig, onNavigate, former } = props;
  /** @type {import('dbgate-datalib').FormViewDisplay} */
  const formDisplay = props.formDisplay;
  const theme = useTheme();
  const [headerRowRef, { height: rowHeight }] = useDimensions();
  const [wrapperRef, { height: wrapperHeight }] = useDimensions();
  const showMenu = useShowMenu();
  const focusFieldRef = React.useRef(null);
  const [currentCell, setCurrentCell] = React.useState([0, 0]);
  const cellRefs = React.useRef({});

  const rowCount = Math.floor((wrapperHeight - 20) / rowHeight);
  const columnChunks = _.chunk(formDisplay.columns, rowCount);

  const { rowData, rowStatus } = former;

  const handleSwitchToTable = () => {
    setConfig((cfg) => ({
      ...cfg,
      isFormView: false,
      formViewKey: null,
    }));
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    showMenu(
      event.pageX,
      event.pageY,
      <FormViewContextMenu switchToTable={handleSwitchToTable} onNavigate={onNavigate} />
    );
  };

  const setCellRef = (row, col, element) => {
    cellRefs.current[`${row},${col}`] = element;
  };

  React.useEffect(() => {
    if (tabVisible) {
      if (focusFieldRef.current) focusFieldRef.current.focus();
    }
  }, [tabVisible, focusFieldRef.current]);

  const checkMoveCursorBounds = (row, col) => {
    if (row < 0) row = 0;
    if (col < 0) col = 0;
    if (col >= columnChunks.length * 2) col = columnChunks.length * 2 - 1;
    const chunk = columnChunks[Math.floor(col / 2)];
    if (chunk && row >= chunk.length) row = chunk.length - 1;
    return [row, col];
  };

  const handleCursorMove = (event) => {
    if (event.ctrlKey) {
      switch (event.keyCode) {
        case keycodes.leftArrow:
          return checkMoveCursorBounds(currentCell[0], 0);
        case keycodes.rightArrow:
          return checkMoveCursorBounds(currentCell[0], columnChunks.length * 2 - 1);
      }
    }
    switch (event.keyCode) {
      case keycodes.leftArrow:
        return checkMoveCursorBounds(currentCell[0], currentCell[1] - 1);
      case keycodes.rightArrow:
        return checkMoveCursorBounds(currentCell[0], currentCell[1] + 1);
      case keycodes.upArrow:
        return checkMoveCursorBounds(currentCell[0] - 1, currentCell[1]);
      case keycodes.downArrow:
        return checkMoveCursorBounds(currentCell[0] + 1, currentCell[1]);
      case keycodes.pageUp:
        return checkMoveCursorBounds(0, currentCell[1]);
      case keycodes.pageDown:
        return checkMoveCursorBounds(rowCount - 1, currentCell[1]);
      case keycodes.home:
        return checkMoveCursorBounds(0, 0);
      case keycodes.end:
        return checkMoveCursorBounds(rowCount - 1, columnChunks.length * 2 - 1);
    }
  };

  const handleKeyNavigation = (event) => {
    if (event.ctrlKey) {
      switch (event.keyCode) {
        case keycodes.upArrow:
          return 'previous';
        case keycodes.downArrow:
          return 'next';
        case keycodes.home:
          return 'begin';
        case keycodes.end:
          return 'end';
      }
    }
  };

  const scrollIntoView = (cell) => {
    const element = cellRefs.current[`${cell[0]},${cell[1]}`];
    if (element) element.scrollIntoView();
  };

  React.useEffect(() => {
    scrollIntoView(currentCell);
  }, [rowData]);

  const moveCurrentCell = (row, col) => {
    const moved = checkMoveCursorBounds(row, col);
    setCurrentCell(moved);
    scrollIntoView(moved);
  };

  const handleKeyDown = (event) => {
    const navigation = handleKeyNavigation(event);
    if (navigation) {
      event.preventDefault();
      onNavigate(navigation);
      return;
    }
    const moved = handleCursorMove(event);
    if (moved) {
      setCurrentCell(moved);
      scrollIntoView(moved);
      event.preventDefault();
      return;
    }
    if (
      !event.ctrlKey &&
      !event.altKey &&
      ((event.keyCode >= keycodes.a && event.keyCode <= keycodes.z) ||
        (event.keyCode >= keycodes.n0 && event.keyCode <= keycodes.n9) ||
        event.keyCode == keycodes.dash)
    ) {
      // @ts-ignore
      dispatchInsplaceEditor({ type: 'show', text: event.nativeEvent.key, cell: currentCell });
      return;
    }
    if (event.keyCode == keycodes.f2) {
      // @ts-ignore
      dispatchInsplaceEditor({ type: 'show', cell: currentCell, selectAll: true });
      return;
    }
  };

  const handleTableMouseDown = (event) => {
    event.preventDefault();
    if (focusFieldRef.current) focusFieldRef.current.focus();

    if (event.target.closest('.buttonLike')) return;
    if (event.target.closest('.resizeHandleControl')) return;
    if (event.target.closest('input')) return;

    // event.target.closest('table').focus();
    event.preventDefault();
    if (focusFieldRef.current) focusFieldRef.current.focus();
    const cell = cellFromEvent(event);

    if (isDataCell(cell) && !_.isEqual(cell, inplaceEditorState.cell) && _.isEqual(cell, currentCell)) {
      // @ts-ignore
      dispatchInsplaceEditor({ type: 'show', cell, selectAll: true });
    } else if (!_.isEqual(cell, inplaceEditorState.cell)) {
      // @ts-ignore
      dispatchInsplaceEditor({ type: 'close' });
    }

    // @ts-ignore
    setCurrentCell(cell);
  };

  const getCellWidth = (row, col) => {
    const element = cellRefs.current[`${row},${col}`];
    if (element) return element.getBoundingClientRect().width;
    return 100;
  };

  const [inplaceEditorState, dispatchInsplaceEditor] = React.useReducer((state, action) => {
    switch (action.type) {
      case 'show':
        // if (!grider.editable) return {};
        return {
          cell: action.cell,
          text: action.text,
          selectAll: action.selectAll,
        };
      case 'close': {
        const [row, col] = currentCell || [];
        if (focusFieldRef.current) focusFieldRef.current.focus();
        // @ts-ignore
        if (action.mode == 'enter' && row) setTimeout(() => moveCurrentCell(row + 1, col), 0);
        // if (action.mode == 'save') setTimeout(handleSave, 0);
        return {};
      }
      case 'shouldSave': {
        return {
          ...state,
          shouldSave: true,
        };
      }
    }
    return {};
  }, {});

  const toolbar =
    toolbarPortalRef &&
    toolbarPortalRef.current &&
    tabVisible &&
    ReactDOM.createPortal(
      <FormViewToolbar switchToTable={handleSwitchToTable} onNavigate={onNavigate} />,
      toolbarPortalRef.current
    );

  if (!formDisplay || !formDisplay.isLoadedCorrectly) return toolbar;

  return (
    <Wrapper ref={wrapperRef} onContextMenu={handleContextMenu}>
      {columnChunks.map((chunk, chunkIndex) => (
        <Table key={chunkIndex} onMouseDown={handleTableMouseDown}>
          {chunk.map((col, rowIndex) => (
            <TableRow key={col.columnName} theme={theme} ref={headerRowRef} style={{ height: `${rowHeight}px` }}>
              <TableHeaderCell
                theme={theme}
                data-row={rowIndex}
                data-col={chunkIndex * 2}
                // @ts-ignore
                isSelected={currentCell[0] == rowIndex && currentCell[1] == chunkIndex * 2}
                ref={(element) => setCellRef(rowIndex, chunkIndex * 2, element)}
              >
                <ColumnLabel {...col} />
              </TableHeaderCell>
              <TableBodyCell
                theme={theme}
                data-row={rowIndex}
                data-col={chunkIndex * 2 + 1}
                // @ts-ignore
                isSelected={currentCell[0] == rowIndex && currentCell[1] == chunkIndex * 2 + 1}
                isModifiedCell={rowStatus.modifiedFields && rowStatus.modifiedFields.has(col.uniqueName)}
                ref={(element) => setCellRef(rowIndex, chunkIndex * 2 + 1, element)}
              >
                {inplaceEditorState.cell &&
                rowIndex == inplaceEditorState.cell[0] &&
                chunkIndex * 2 + 1 == inplaceEditorState.cell[1] ? (
                  <InplaceEditor
                    widthPx={getCellWidth(rowIndex, chunkIndex * 2 + 1)}
                    inplaceEditorState={inplaceEditorState}
                    dispatchInsplaceEditor={dispatchInsplaceEditor}
                    cellValue={rowData[col.uniqueName]}
                    onSetValue={(value) => {
                      former.setCellValue(col.uniqueName, value);
                    }}
                    // grider={grider}
                    // rowIndex={rowIndex}
                    // uniqueName={col.uniqueName}
                  />
                ) : (
                  <>
                    <CellFormattedValue value={rowData && rowData[col.columnName]} dataType={col.dataType} />
                  </>
                )}
              </TableBodyCell>
            </TableRow>
          ))}
        </Table>
      ))}

      <FocusField type="text" ref={focusFieldRef} onKeyDown={handleKeyDown} />

      {toolbar}
    </Wrapper>
  );
}
