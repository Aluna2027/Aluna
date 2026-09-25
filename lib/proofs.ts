export const evidenceTypes=[
 {value:'photo',label:'Photo'}, {value:'video',label:'Video'}, {value:'geolocation',label:'Geolocation'},
 {value:'partner_confirmation',label:'Partner confirmation'}, {value:'local_survey',label:'Local survey'},
 {value:'sensor_data',label:'Sensor data'}, {value:'mesh_telemetry',label:'Mesh telemetry'},
] as const;
export const verificationLevels=['','L1 Self-Reported','L2 Peer-Attested','L3 Partner-Verified','L4 Ground-Verified'] as const;
export type Proof={id:string;actor_id:string;mission_id:string|null;city_id:string|null;contribution_id:string|null;post_id:string|null;post_snapshot:string|null;evidence_type:string;evidence_url:string|null;evidence_description:string;latitude:number|null;longitude:number|null;result_text:string;occurred_on:string;verification_level:number;created_at:string};
