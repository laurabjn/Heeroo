import React, { useState, useEffect } from 'react';
import MaterialTable from 'material-table';
import { useSelector, useDispatch } from "react-redux";
import CircularLoading from "../components/CircularLoading";
import SecureImage from "../components/SecureImage";
import languageJson from "../config/language";
import {
  editUser, deleteUser,
  adjustDriverWallet,
} from "../actions/usersactions";
import moment from "moment"
import countryNameFile from './../countryName.json'


export default function Users() {
  const [data, setData] = useState([]);
  const [cars, setCars] = useState({});
  const usersdata = useSelector(state => state.usersdata);
  const cartypes = useSelector(state => state.cartypes);
  const dispatch = useDispatch();

  useEffect(() => {
    if (usersdata.users) {
      setData(usersdata.users);
    }
  }, [usersdata.users]);

  useEffect(() => {
    if (cartypes.cars) {
      let obj = {};
      console.log(cartypes.cars);
      cartypes.cars.map((car) => obj[car.name] = car.name)
      setCars(obj);
    }
  }, [cartypes.cars]);

  const columns = [
    { title: languageJson.createdAt, field: 'createdAt', editable: 'never', defaultSort: 'desc', render: rowData => rowData.createdAt ? moment(rowData.createdAt).format("DD.MM.YYYY HH[h]mm") : null },
    { title: languageJson.country, field: 'country', editable: 'never', lookup: countryNameFile },
    { title: languageJson.driver_active, field: 'driverActiveStatus', render: rowData => rowData.usertype == "driver" ? rowData.driverActiveStatus ? <text style={{ color: "green", border: "1px solid green", padding: "4px" }} >Actif</text> : <text style={{ color: "red", border: "1px solid red", padding: "4px" }} >Inactif</text> : " ", editable: 'never' },
    { title: languageJson.first_name, field: 'firstName', editable: 'never' },
    { title: languageJson.last_name, field: 'lastName', editable: 'never' },
    { title: languageJson.user_type, field: 'usertype', editable: 'never' },
    { title: languageJson.email, field: 'email', editable: 'never' },
    { title: languageJson.mobile, field: 'mobile', editable: 'never' },
    { title: languageJson.companyName, field: 'companyName', render: rowData => rowData.companyName ? rowData.companyName : null, editable: 'never' },
    { title: languageJson.companyAddress, field: 'companyAddress', render: rowData => rowData.companyAddress ? rowData.companyAddress : null, editable: 'never' },
    { title: languageJson.profile_image, sorting: false, field: 'profile_image', render: rowData => rowData.profile_image ? <SecureImage alt='Profile' src={rowData.profile_image} style={{ width: 50, borderRadius: '50%' }} /> : null, editable: 'never' },
    { title: languageJson.vehicle_model, field: 'vehicleModel', editable: 'never' },
    { title: languageJson.car_type, field: 'carType', lookup: cars },
    { title: languageJson.account_approve, sorting: false, field: 'approved', type: 'boolean' },
    { title: languageJson.wallet_balance, sorting: false, field: 'walletBalance', type: 'numeric', editable: 'never' },
    { title: languageJson.signup_via_refferal, sorting: false, field: 'signupViaReferral', type: 'boolean', editable: 'never' },
    { title: languageJson.refferal_id, sorting: false, field: 'refferalId', editable: 'never' },
    { title: languageJson.queue, sorting: false, field: 'queue', type: 'boolean' },
    { title: languageJson.identity, sorting: false, field: 'profile_image', render: rowData => rowData.file_identity_front ? <SecureImage alt='Profile' src={rowData.file_identity_front} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: languageJson.identity, sorting: false, field: 'profile_image', render: rowData => rowData.file_identity_back ? <SecureImage alt='Profile' src={rowData.file_identity_back} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "Permis", sorting: false, field: 'Permis', render: rowData => rowData.permis ? <SecureImage alt='permis' src={rowData.permis} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "Carte Grise", sorting: false, field: 'carteGrise', render: rowData => rowData.carteGrise ? <SecureImage alt='carteGrise' src={rowData.carteGrise} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "Carte VTC", sorting: false, field: 'carteVTC', render: rowData => rowData.carteVTC ? <SecureImage alt='carteVTC' src={rowData.carteVTC} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "Carte Verte", sorting: false, field: 'carteVerte', render: rowData => rowData.carteVerte ? <SecureImage alt='carteVerte' src={rowData.carteVerte} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "Attestation", sorting: false, field: 'attestation', render: rowData => rowData.attestation ? <SecureImage alt='attestation' src={rowData.attestation} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "Assurance RC", sorting: false, field: 'assuranceRC', render: rowData => rowData.assuranceRC ? <SecureImage alt='assuranceRC' src={rowData.assuranceRC} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "Photo Avant Vehicule", sorting: false, field: 'photoAvantVehicule', render: rowData => rowData.photoAvantVehicule ? <SecureImage alt='photoAvantVehicule' src={rowData.photoAvantVehicule} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "Photo Chauffeur", sorting: false, field: 'photoChauffeur', render: rowData => rowData.photoChauffeur ? <SecureImage alt='photoChauffeur' src={rowData.photoChauffeur} style={{ width: 100 }} /> : null, editable: 'never' },
    { title: "R.I.R", sorting: false, field: 'rir', render: rowData => rowData.rir ? <SecureImage alt='rir' src={rowData.rir} style={{ width: 100 }} /> : null, editable: 'never' },

  ];

  return (
    usersdata.loading ? <CircularLoading /> :
      <MaterialTable
        title={languageJson.all_user}
        columns={columns}
        data={data}
        options={{
          exportButton: true,
          sorting: true,

        }}
        actions={[
          rowData => ({
            icon: 'account_balance_wallet',
            tooltip: languageJson.wallet_adjust_action,
            hidden: rowData.usertype !== 'driver',
            onClick: async (event, row) => {
              const who = (row.firstName || '') + ' ' + (row.lastName || '');
              const raw = window.prompt(languageJson.wallet_adjust_title + ' — ' + who + String.fromCharCode(10) + languageJson.wallet_adjust_prompt, '');
              if (raw === null) return;
              const amount = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
              if (!Number.isFinite(amount) || amount === 0) { window.alert(languageJson.wallet_adjust_failed + 'montant invalide'); return; }
              const note = window.prompt(languageJson.wallet_adjust_note, '') || '';
              try {
                const result = await adjustDriverWallet(row.id, amount, note);
                if (result && result.success) window.alert(languageJson.wallet_adjust_done + result.balance.toLocaleString('fr-FR') + ' FCFA');
                else window.alert(languageJson.wallet_adjust_failed + (result && result.error ? result.error : 'erreur inconnue'));
              } catch (e) {
                window.alert(languageJson.wallet_adjust_failed + e.message);
              }
            },
          }),
        ]}
        editable={{
          onRowUpdate: (newData, oldData) =>
            new Promise(resolve => {
              setTimeout(() => {
                resolve();
                dispatch(editUser(oldData.id, newData));
              }, 600);
            }),

          onRowDelete: oldData =>
            new Promise(resolve => {
              setTimeout(() => {
                resolve();
                dispatch(deleteUser(oldData.id));
              }, 600);
            }),
        }}
      />
  );
}
