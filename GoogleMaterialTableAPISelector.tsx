import React from 'react';
import axios from 'axios';
import { Autocomplete } from '@material-ui/lab';
import {
  IAddressApiFullAddress,
  IAddressApiSuggestions,
  IDatabaseAddress
} from 'types/address';
import { Address_API, createAddressApiRequestConfig } from '../functions';
import { handleAddressObject } from 'components/Fields/InlineTextField/functions/handleAddressObject';
import { makeStyles, useTheme } from '@material-ui/core/styles';

import {
  CircularProgress,
  TextField,
  Grid,
  Button,
  Typography
} from '@material-ui/core';
import {
  CompleteObjectInstance,
  FieldDefinition,
  FieldDefinitionDict,
  FieldInstance,
  FieldInstanceDict,
  ProcessInstance
} from 'types/interfaces';
import { BugTracker } from 'Utils/Bugtracker';
import MaterialTable from '@material-table/core';
import Address from '..';

interface IAddress {
  required: boolean;
  type: string;
}

interface IAddressSearch {
  postcode: string;
  county: string;
  town_or_city: string;
  country: string;
}

interface IWarning {
  warning: boolean;
  text: string;
}

const AddressValues: IAddress[] = [
  {
    required: true,
    type: 'Postcode'
  },
  {
    required: false,
    type: 'County'
  },
  {
    required: false,
    type: 'Town Or City'
  },
  {
    required: false,
    type: 'Country'
  },
  {
    required: false,
    type: 'Line 1'
  },
  {
    required: false,
    type: 'Line 2'
  }
];

const INIT_AddressSearch: IAddressSearch = {
  postcode: '',
  county: '',
  town_or_city: '',
  country: ''
};

type AddressProps = {
  isIntegration: boolean;
  refreshDealData?: () => void;
  ProcessInstance?: ProcessInstance;
  ProcessInstanceId?: number;
  FieldDefinitionDict?: FieldDefinitionDict;
  CompleteObjectInstance?: CompleteObjectInstance;
  FieldDefinitionList?: FieldDefinition[];
};

type RequiredProperties<T> = T extends { isIntegration: true }
  ? { [K in keyof T]-?: T[K] }
  : T;

type RequiredAddressProps = RequiredProperties<AddressProps>;
export const AutocompleteAddress = ({
  setAddress,
  setWarning,
  props
}: {
  setWarning?: (warning: IWarning) => void;
  props: RequiredAddressProps;
  setAddress?: (address: IAddressApiFullAddress | null) => void;
}) => {
  const {
    ProcessInstance,
    ProcessInstanceId,
    FieldDefinitionDict,
    CompleteObjectInstance,
    FieldDefinitionList,
    isIntegration,
    refreshDealData
  } = props;
  const [addressTypes, setAddressTypes] =
    React.useState<IAddress[]>(AddressValues);
  const [formState, setFormState] =
    React.useState<IAddressSearch>(INIT_AddressSearch);

  const [isDetailPanelLoading, setIsDetailPanelLoading] = React.useState(false);
  const [selectedAddress, setSelectedAddress] = React.useState<boolean>(false);

  const [selectedTextBox, setSelectedTextBox] = React.useState('');
  const [expandedRow, setExpandedRow] =
    React.useState<IAddressApiFullAddress | null>(null);

  const [suggestions, setSuggestions] = React.useState<
    IAddressApiSuggestions[]
  >([]);

  const tableRef = React.createRef<any>();

  const isFormComplete = () => {
    return AddressValues.every((element) => {
      if (element.required) {
        const value = formState[element.type.toLowerCase().replace(/ /g, '_')];
        return value !== undefined && value !== null && value !== '';
      }
      return true;
    });
  };

  const checkFieldInstanceDict = (): boolean => {
    if (isIntegration) {
      const hasNonEmptyFieldValue = !!(
        CompleteObjectInstance?.FieldInstanceDict &&
        Object.values(CompleteObjectInstance.FieldInstanceDict).some(
          (fieldInstance: FieldInstance) => fieldInstance.FieldValue !== ''
        )
      );

      return hasNonEmptyFieldValue;
    }

    return false;
  };

  const fetchSuggestions = async () => {
    if (isFormComplete()) {
      if (!checkFieldInstanceDict()) {
        const addressInput = Object.values(formState)
          .filter((value) => value)
          .join(', ');

        try {
          const response = await axios(await Address_API(addressInput));
          setSuggestions(response.data.Address.suggestions);
        } catch (e) {
          BugTracker.notify(e);
        }
      }
    } else
      setWarning &&
        setWarning({ warning: true, text: 'Please Assign A Valid Postcode' });
  };

  const fetchAndSetDetailedAddress = async (
    rowData: IAddressApiSuggestions
  ) => {
    setIsDetailPanelLoading(true);
    try {
      const response = await axios(
        await createAddressApiRequestConfig(rowData.id)
      );
      rowData.detailedAddress = response.data.Address as IAddressApiFullAddress;
      setExpandedRow(response.data.Address as IAddressApiFullAddress);
    } catch (e) {
      BugTracker.notify(e);
    } finally {
      setIsDetailPanelLoading(false);
    }
  };

  const handleSelect = async (
    _,
    selectedSuggestion: IAddressApiSuggestions
  ) => {
    if (!formState) return;

    try {
      const response = await axios(
        await createAddressApiRequestConfig(selectedSuggestion.id)
      );

      const validatedData = response.data;

      if (validatedData?.name !== 'Error') {
        if (isIntegration) {
          if (
            ProcessInstance &&
            CompleteObjectInstance &&
            ProcessInstanceId &&
            FieldDefinitionDict
          ) {
            const Address: IDatabaseAddress = {
              validated: validatedData.Address,
              fullAddress: suggestions[0]
            };
            handleAddressObject({
              ProcessInstance,
              CompleteObjectInstance,
              ProcessInstanceId,
              FieldDefinitionDict,
              fullAddress: Address
            });

            refreshDealData && refreshDealData();
          }
        } else {
          setAddress && setAddress(validatedData.Address);
        }
      }
    } catch (e) {
      BugTracker.notify(e);
    }

    setSelectedAddress(true);
  };

  const isFormEmpty = () => {
    return Object.keys(formState).every(
      (key) => formState[key as keyof IAddressSearch] === ''
    );
  };

  React.useEffect(() => {
    if (isFormEmpty()) {
      setSuggestions([]);
    } else fetchSuggestions();
  }, [formState]);

  React.useEffect(() => {
    if (isIntegration) {
      if (FieldDefinitionList) {
        addressTypes.forEach((addressType: IAddress) => {
          const element = FieldDefinitionList.find(
            (fieldDefinition) => fieldDefinition.Title === addressType.type
          );

          if (element) {
            const filterValues =
              CompleteObjectInstance?.FieldInstanceDict &&
              Object.values(CompleteObjectInstance.FieldInstanceDict).filter(
                (item: FieldInstance) => item.FieldDefinitionId === element.Id
              );

            filterValues?.forEach((item: FieldInstance) => {
              const key = element.Title.toLowerCase().replace(/ /g, '_');
              if (key in formState) {
                setFormState((prevState) => ({
                  ...prevState,
                  [key]: item.FieldValue
                }));
              }
            });
          }
        });
      }
    }
  }, []);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (name === selectedTextBox) {
      setFormState((prevState) => ({ ...prevState, [name]: value }));
    } else {
      setSelectedTextBox(name);
    }
  };

  const handleBlur = (
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (name === selectedTextBox) {
      setFormState((prevState) => ({ ...prevState, [name]: value }));
      setSelectedTextBox('');
    }
  };

  return (
    <Grid container justifyContent="center" alignItems="center" spacing={1}>
      {Object.values(addressTypes).map((element: IAddress, index: number) => {
        return (
          <Grid item key={index}>
            <TextField
              key={index}
              label={element.type}
              required={element.required ? true : false}
              variant="outlined"
              name={element.type.toLowerCase().replace(/ /g, '_')}
              value={formState[element.type.toLowerCase().replace(/ /g, '_')]}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </Grid>
        );
      })}

      <br />

      {suggestions.length >= 1 && !selectedAddress && (
        <MaterialTable
          tableRef={tableRef}
          style={{ width: '100%' }}
          title="Searched Addresses"
          columns={[
            {
              title: 'Address',
              field: 'address'
            }
          ]}
          onRowClick={(_, rowData: any) => {
            handleSelect(_, rowData);
          }}
          actions={[
            {
              icon: 'unfold_more',
              tooltip: 'Expand For More Detail',
              onClick: (event, rowData: any) => {
                tableRef.current.onToggleDetailPanel(
                  [
                    tableRef.current.dataManager.sortedData.findIndex(
                      (item) => item.id === rowData.id
                    )
                  ],
                  tableRef.current.props.detailPanel[0].render
                );

                if (expandedRow === rowData) {
                  setExpandedRow(null);
                } else {
                  fetchAndSetDetailedAddress(rowData);
                }
              },
              isFreeAction: false
            }
          ]}
          detailPanel={[
            {
              icon: () => null,
              openIcon: () => null,
              disabled: true,
              render: (rowData) => {
                if (expandedRow && !isDetailPanelLoading) {
                  return <Address rowData={expandedRow} />;
                } else {
                  return (
                    <Grid
                      container
                      justifyContent="center"
                      alignItems="center"
                      spacing={1}>
                      <Grid item>
                        <CircularProgress />
                      </Grid>
                    </Grid>
                  );
                }
              }
            }
          ]}
          data={suggestions}
          options={{
            detailPanelType: 'single',
            actionsColumnIndex: -1,
            pageSize: 10,
            paging: true
          }}
        />
      )}
    </Grid>
  );
};
