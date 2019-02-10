'use strict';

import _ from 'lodash'

import NI from './util/NetworkInterface'
import * as queries from './scripts/phaseQueries'
import {PhaseGroup} from './PhaseGroup' //TODO change this to internal
import {GGSet, IGGSet} from './GGSet'
import {Entrant, IEntrant} from './Entrant'
import {Seed, ISeed} from './Seed'
import {Attendee, IAttendee} from './Attendee'
import PaginatedQuery from './util/PaginatedQuery'
import Encoder from './util/Encoder'
import Cache from './util/Cache'
import log from './util/Logger'

import { ICommon } from './util/Common'
import { IPhaseGroup } from './PhaseGroup';
import { phaseGroup } from './scripts/phaseGroupQueries';

export class Phase implements IPhase.Phase{

	id: number
	eventId: number
	name: string
	numSeeds: number
	groupCount: number

	constructor(
		id: number,
		eventId: number,
		name: string,
		numSeeds: number,
		groupCount: number
	){
		this.id = id
		this.eventId = eventId
		this.name = name
		this.numSeeds = numSeeds
		this.groupCount = groupCount
	}

	static parse(data: IPhase.PhaseData, eventId: number) : Phase{
		return new Phase(
			data.id,
			eventId || -1,
			data.name,
			data.numSeeds,
			data.groupCount
		)
	}

	static async get(id: number, eventId: number) : Promise<Phase> {
		log.info('Getting Phase with id %s and event id %s', id, eventId)
		let data: IPhase.Data = await NI.query(queries.phase, {id: id});
		return Phase.parse(data.phase, eventId);
	}
	
	getId(): number{
		return this.id
	}

	getEventId(): number{
		return this.eventId
	}

	getName(): string{
		return this.name
	}

	getNumSeeds(): number{
		return this.numSeeds
	}

	getGroupCount(): number{
		return this.groupCount
	}

	async getPhaseGroups() : Promise<PhaseGroup[]> {
		log.info('Getting phase groups for phase %s', this.id)
		let data: IPhase.PhaseGroupData = await NI.query(queries.phasePhaseGroups, {eventId: this.eventId})
		let phaseGroupData: IPhaseGroup.PhaseGroupData[] = data.event.phaseGroups.filter(phaseGroupData => phaseGroupData.phaseId === this.id)
		let phaseGroups: PhaseGroup[] = phaseGroupData.map(pg => PhaseGroup.parse(pg))
		return phaseGroups;
	}

	async getSeeds(options: ISeed.SeedOptions) : Promise<Seed[]> {
		log.info('Getting seeds for phase %s', this.id)
		log.verbose('Query variables: %s', JSON.stringify(options))

		let data: IPhase.PhaseSeedData[] = await PaginatedQuery.query(
			`Phase Seeds [${this.id}]`, 
			queries.phaseSeeds, {id: this.id},
			options, {}, 2
		)
		let seedData: ISeed.SeedData[] = _.flatten(data.map(results => results.phase.paginatedSeeds.nodes)).filter(seed => seed != null)
		let seeds = seedData.map( (seedData: ISeed.SeedData) => Seed.parse(seedData) )
		return seeds
	}

	async getEntrants(options: IEntrant.EntrantOptions = IEntrant.getDefaultEntrantOptions()) : Promise<Entrant[]> {
		log.info('Getting entrants for phase %s', this.id)
		log.verbose('Query variables: %s', JSON.stringify(options))

		let data: IPhase.PhaseEntrantData[] = await PaginatedQuery.query(
			`Phase Entrants [${this.id}]`, 
			queries.phaseEntrants, {id: this.id}, 
			options, {}, 2
		)
		let entrantData: IEntrant.Data[] = _.flatten(data.map(entrantData => entrantData.phase.paginatedSeeds.nodes )).filter(entrant => entrant != null)
		let entrants: Entrant[] = entrantData.map(e => Entrant.parseFull(e)) as Entrant[];
		return entrants
	}

	async getAttendees(options: IAttendee.AttendeeOptions = IAttendee.getDefaultAttendeeOptions()) : Promise<Attendee[]> {
		log.info('Getting attendees for phase %s', this.id)
		log.verbose('Query variables: %s', JSON.stringify(options))

		let data: IPhase.PhaseAttendeeData[] = await PaginatedQuery.query(
			`Phase Attendees [${this.id}]`,
			queries.phaseAttendees, {id: this.id},
			options, {}, 3
		)
		let seeds = _.flatten(data.map(seed => seed.phase.paginatedSeeds))
		let nodes = _.flatten(seeds.map(seed => seed.nodes))
		let entrants = nodes.map(node => node.entrant)
		let participants = _.flatten(entrants.map(entrant => entrant.participants)).filter(participant => participant != null)
		let attendees = participants.map(participant => Attendee.parse(participant))
		return attendees
	}

	async getSets2(options: IGGSet.SetOptions = IGGSet.getDefaultSetOptions()) : Promise<GGSet[]> {
		log.info('Getting sets for phase %s', this.id)

		let pg = await this.getPhaseGroups()
		let ids = _.flatten(pg.map(group => group.getId()))
		let filters = {phaseGroupIds: ids.slice(0, 2)}

		// add this phase's id to the filters for sets
		log.verbose('Query variables: %s', JSON.stringify(options))

		let data: IPhase.DataSets[] = await PaginatedQuery.query(
			`Phase Sets [${this.id}]`, queries.phaseSets, 
			{eventId: this.eventId, phaseId: this.id, filters: filters}, 
			options, {}, 3
		)
		let phaseGroups = _.flatten(data.map(setData => setData.event.phaseGroups))
		let setsData: IGGSet.SetData[] = _.flatten(phaseGroups.map(pg => pg.paginatedSets.nodes)).filter(set => set != null)
		let sets = setsData.map( (setData: IGGSet.SetData) => GGSet.parse(setData) )
		return sets
	}

	async getSets3(options: IGGSet.SetOptions = IGGSet.getDefaultSetOptions()) : Promise<GGSet[]> {
		log.info('Getting sets for phase %s', this.id)
		log.verbose('Query variables: %s', JSON.stringify(options))
		let phaseGroups: PhaseGroup[] = await this.getPhaseGroups()
		let sets: GGSet[] = _.flatten(await Promise.all(phaseGroups.map(async (pg) => await pg.getSets(options))))
		return sets
	}

	async getSets(options: IGGSet.SetOptions = IGGSet.getDefaultSetOptions()) : Promise<GGSet[]> {
		log.info('Getting sets for phase %s', this.id)

		// add this phase's id to the filters for sets
		if(options.filters)
			_.assign(options.filters, {phaseIds: [this.id]})
		else options.filters = {phaseIds: [this.id]}
		log.verbose('Query variables: %s', JSON.stringify(options))

		let data: IPhase.DataSets[] = await PaginatedQuery.query(
			`Phase Sets [${this.id}]`, queries.phaseSets, 
			{eventId: this.eventId, phaseId: this.id}, 
			options, {}, 4
		)
		let phaseGroups = _.flatten(data.map(setData => setData.event.phaseGroups))
		let setsData: IGGSet.SetData[] = _.flatten(phaseGroups.map(pg => pg.paginatedSets.nodes)).filter(set => set != null)
		let sets = setsData.map( (setData: IGGSet.SetData) => GGSet.parse(setData) )
		return sets
	}

	async getIncompleteSets(options: IGGSet.SetOptions = IGGSet.getDefaultSetOptions()) : Promise<GGSet[]> {
		return GGSet.filterForIncompleteSets(await this.getSets(options))
	}

	async getCompleteSets(options: IGGSet.SetOptions = IGGSet.getDefaultSetOptions()) : Promise<GGSet[]> {
		return GGSet.filterForCompleteSets(await this.getSets(options))
	}

	async getSetsXMinutesBack(minutesBack: number, options: IGGSet.SetOptions = IGGSet.getDefaultSetOptions()) : Promise<GGSet[]> {
		return GGSet.filterForXMinutesBack(await this.getSets(options), minutesBack)
	}
}

export namespace IPhase{
	export interface Phase{
		
		id: number
		name: string
		eventId: number
		numSeeds: number
		groupCount: number


		getId(): number
		getEventId(): number
		getName(): string
		getNumSeeds(): number
		getGroupCount(): number	
		getPhaseGroups() : Promise<PhaseGroup[]>
		getSets(options: IGGSet.SetOptions) : Promise<GGSet[]>
		getEntrants(options: IEntrant.EntrantOptions) : Promise<Entrant[]>
		getIncompleteSets(options: IGGSet.SetOptions) : Promise<GGSet[]>
		getCompleteSets(options: IGGSet.SetOptions) : Promise<GGSet[]>
		getSetsXMinutesBack(minutesBack: number, options: IGGSet.SetOptions) : Promise<GGSet[]>

	}


	export interface Data{
		phase: PhaseData 
	}

	export interface DataSeeds{
		event: PhaseSeedData
	}

	export interface DataSets{
		event: PhaseSetData
	}

	export interface DataEntrants{
		event: PhaseEntrantData
	}

	export interface PhaseData{
		id: number,
		name: string,
		numSeeds: number,
		groupCount: number
	}

	export interface PhaseSeedData{
		phase:{
			paginatedSeeds: {
				pageInfo?:{
					totalPages: number
				}
				nodes: ISeed.SeedData[]
			} 
		}
	}

	export interface PhaseSetData{
		id: number,
		phaseGroups: {
			paginatedSets: {
				pageInfo?: { totalPages: number }
				nodes: IGGSet.SetData[]
			}
		}
	}

	export interface PhaseEntrantData{
		phase: {
			paginatedSeeds:{
				pageInfo?:{
					totalPages: number
				}
				nodes: IEntrant.Data[]
			} 
		}
	}

	export interface PhaseGroupData{
		event:{
			phaseGroups: IPhaseGroup.PhaseGroupData[]
		}
	}

	export interface PhaseAttendeeData{
		phase:{
			paginatedSeeds:{
				pageInfo?:{
					totalPages: number
				}
				nodes:{
					entrant:{
						participants: IAttendee.AttendeeData[]
					}
				}
			}[]
		}
	}
}