import { describe, expect, it } from 'vitest'
import { parseShealth, shealthKind, sleepHoursIn } from './shealth'
import { avgSleep, sleepGoalDates, withSleepChecks } from './sleepStats'

// made-up rows in the shape of a Samsung Health export (times are UTC, KST = +9h)
const SLEEP = `com.samsung.health.sleep_stage,7010053,7
create_sh_ver,start_time,sleep_id,custom,modify_sh_ver,update_time,create_time,stage,time_offset,deviceuuid,pkg_name,end_time,datauuid
,2026-10-18 14:00:00.000,night1,,,x,x,40002,UTC+0900,d,com.garmin.android.apps.connectmobile,2026-10-18 16:00:00.000,a,
,2026-10-18 16:00:00.000,night1,,,x,x,40003,UTC+0900,d,com.garmin.android.apps.connectmobile,2026-10-18 17:30:00.000,b,
,2026-10-18 17:30:00.000,night1,,,x,x,40001,UTC+0900,d,com.garmin.android.apps.connectmobile,2026-10-18 17:40:00.000,c,
,2026-10-18 17:40:00.000,night1,,,x,x,40004,UTC+0900,d,com.garmin.android.apps.connectmobile,2026-10-18 21:40:00.000,e,
,2026-10-19 05:00:00.000,nap,,,x,x,40002,UTC+0900,d,com.sec.android.app.shealth,2026-10-19 05:30:00.000,f,
,2026-10-19 15:00:00.000,night2,,,x,x,40002,UTC+0900,d,com.sec.android.app.shealth,2026-10-19 20:00:00.000,g,
`

const MEALS = `com.samsung.health.nutrition,7010053,6
calorie,protein,carbohydrate,total_fat,sodium,meal_type,title,start_time,time_offset,datauuid
400,20,50,10,700,100001,아침,2026-10-19 23:00:00.000,UTC+0900,a,
400,20,50,10,700,100001,아침,2026-10-19 23:00:00.000,UTC+0900,b,
800,40,100,25,1500,100002,점심,2026-10-20 03:00:00.000,UTC+0900,c,
`

const STEPS = `com.samsung.shealth.step_daily_trend,7010053,6
binning_data,source_type,count,distance,calorie,day_time
x,-2,5703,4349.8,170,2026-10-21 00:00:00.000,
x,0,5100,4000,160,2026-10-21 00:00:00.000,
x,0,3323,2526.5,100,2026-10-20 00:00:00.000,
`

describe('samsung health import', () => {
  it('recognizes only the files it reads', () => {
    expect(shealthKind(SLEEP)).toBe('sleep')
    expect(shealthKind(MEALS)).toBe('nutrition')
    expect(shealthKind('com.samsung.shealth.preferences,7010053,2\na,b\n')).toBeUndefined()
    expect(parseShealth('com.samsung.health.device_profile,1,1\nname\n재영 폰\n')).toBeUndefined()
  })

  it('turns sleep stages into nights by wake-up date, in local time, keeping the longest sleep', () => {
    const nights = parseShealth(SLEEP)!.sleep!
    expect(nights).toEqual([
      { date: '2026-10-19', start: '2026-10-18 23:00', end: '2026-10-19 06:40', minutes: 450, awake: 10, light: 120, deep: 90, rem: 240, source: '가민' },
      { date: '2026-10-20', start: '2026-10-20 00:00', end: '2026-10-20 05:00', minutes: 300, awake: 0, light: 300, deep: 0, rem: 0, source: '삼성' },
    ])
  })

  it('adds up meals per local day and skips exported duplicates', () => {
    expect(parseShealth(MEALS)!.nutrition).toEqual([{ date: '2026-10-20', kcal: 1200, protein: 60, carb: 150, fat: 35, sodium: 2200, meals: 2 }])
  })

  it('keeps the highest step count per day', () => {
    expect(parseShealth(STEPS)!.steps).toEqual([
      { date: '2026-10-20', steps: 3323, km: 2.5 },
      { date: '2026-10-21', steps: 5703, km: 4.3 },
    ])
  })

  it('checks sleep goals from the recorded nights and averages them', () => {
    const nights = parseShealth(SLEEP)!.sleep!
    expect(sleepHoursIn('7시간 이상 자기')).toBe(7)
    const goal = { id: 'g', title: '7시간 이상 자기', category: 'sleep', repeat: 'daily' as const, checks: ['2026-10-15'] }
    expect([...sleepGoalDates(goal, nights)]).toEqual(['2026-10-19'])
    expect(withSleepChecks(goal, nights).checks).toEqual(['2026-10-15', '2026-10-19'])
    expect(sleepGoalDates({ ...goal, category: 'water' }, nights).size).toBe(0)
    expect(avgSleep(nights, '2026-10-20', 7, 2)).toBe(375)
    expect(avgSleep(nights, '2026-10-20')).toBeUndefined()
  })
})
